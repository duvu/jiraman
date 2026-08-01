const privateKeyBegin = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----/i;
const privateKeyEnd = /-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----/i;
const credentialAssignmentLine = /["']?\b(?:(?:password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|secret[_-]?key|auth[_-]?token)|(?:[A-Z0-9]+[_-])+(?:TOKEN|SECRET|PASSWORD|PASSWD|(?:ACCESS|SECRET|PRIVATE|API)[_-]?KEY))\b["']?\s*[=:]\s*(.*)$/i;

export const sensitivePatterns = [
  { name: "private-key", expression: privateKeyBegin },
  { name: "aws-access-key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "authorization-header", expression: /Authorization:\s*(?:Basic|Bearer)\s+\S{8,}/i },
  { name: "cookie-header", expression: /(?:Cookie|Set-Cookie):\s*[^\r\n]{8,}/i },
  { name: "credential-assignment", expression: /["']?\b(?:password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|secret[_-]?key|auth[_-]?token)\b["']?\s*[=:]\s*["']?[^\s"']{8,}/i },
  { name: "generic-multiline-credential", expression: /["']?\b(?:password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|secret[_-]?key|auth[_-]?token)\b["']?\s*[=:]\s*\\?["']?\s*[^\s"']{8,}/i },
  { name: "provider-credential", expression: /["']?\b(?:[A-Z0-9]+[_-])+(?:TOKEN|SECRET|PASSWORD|PASSWD|(?:ACCESS|SECRET|PRIVATE|API)[_-]?KEY)\b["']?\s*[=:]\s*\\?["']?\s*[^\s"']{8,}/i },
  { name: "credential-block-scalar", expression: /["']?\b(?:[A-Z0-9]+[_-])+(?:TOKEN|SECRET|PASSWORD|PASSWD|(?:ACCESS|SECRET|PRIVATE|API)[_-]?KEY)\b["']?\s*:\s*[|>][1-9+-]{0,2}(?:[ \t]+#[^\r\n]*)?\r?\n(?:[ \t]*\r?\n)*[ \t]+\S+/i },
  { name: "generic-credential-block-scalar", expression: /["']?\b(?:password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|secret[_-]?key|auth[_-]?token)\b["']?\s*:\s*[|>][1-9+-]{0,2}(?:[ \t]+#[^\r\n]*)?\r?\n(?:[ \t]*\r?\n)*[ \t]+\S+/i },
  { name: "github-token", expression: new RegExp("\\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\\b", "i") },
  { name: "github-fine-grained-token", expression: new RegExp("\\bgithub_pat_[A-Za-z0-9_]{20,}\\b", "i") },
  { name: "npm-token", expression: new RegExp("\\bnpm_[A-Za-z0-9]{20,}\\b", "i") },
  { name: "slack-token", expression: new RegExp("\\bxox(?:b|a|p|r|s)-[A-Za-z0-9-]{20,}\\b", "i") },
  { name: "jwt", expression: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: "google-api-key", expression: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name: "stripe-live-key", expression: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/i },
  { name: "credential-url", expression: /https?:\/\/[^/\s:@]+:[^/\s@]{8,}@/i },
  { name: "private-atlassian-url", expression: /https:\/\/[A-Za-z0-9.-]+\.atlassian\.net/i },
  { name: "test-canary", expression: new RegExp(["TEST", "ONLY"].join("_") + "_", "i") },
];

export function findSensitiveNames(text) {
  return sensitivePatterns.filter((pattern) => pattern.expression.test(text)).map((pattern) => pattern.name);
}

export function sanitizeSensitiveText(text) {
  let privateKeyBlock = false;
  let pendingCredential = null;
  let pendingCredentialIndent = 0;
  return text.split(/\r?\n/).map((line) => {
    if (privateKeyBlock) {
      if (privateKeyEnd.test(line)) privateKeyBlock = false;
      return "[REDACTED SENSITIVE LINE]";
    }
    if (privateKeyBegin.test(line)) {
      if (!privateKeyEnd.test(line)) privateKeyBlock = true;
      return "[REDACTED SENSITIVE LINE]";
    }
    if (pendingCredential !== null) {
      if (pendingCredential === "yaml") {
        const indentation = line.match(/^[ \t]*/)?.[0].length ?? 0;
        if (line.trim().length === 0 || indentation > pendingCredentialIndent) return "[REDACTED SENSITIVE LINE]";
        pendingCredential = null;
      } else if (pendingCredential === "") {
        if (line.trim().length > 0) pendingCredential = null;
        return "[REDACTED SENSITIVE LINE]";
      } else if (line.includes(pendingCredential)) {
        pendingCredential = null;
        return "[REDACTED SENSITIVE LINE]";
      } else {
        return "[REDACTED SENSITIVE LINE]";
      }
    }
    const assignment = credentialAssignmentLine.exec(line);
    if (assignment !== null) {
      const remainder = (assignment[1] ?? "").trimStart();
      const escapedQuote = remainder.startsWith("\\\"") || remainder.startsWith("\\'");
      const quote = remainder.startsWith("\"") || remainder.startsWith("\\\"") ? "\"" : remainder.startsWith("'") || remainder.startsWith("\\'") ? "'" : null;
      const value = quote === null ? remainder : remainder.slice(escapedQuote ? 2 : 1);
      if (/^[|>][1-9+-]{0,2}(?:\s+#.*)?\s*$/.test(remainder)) {
        pendingCredential = "yaml";
        pendingCredentialIndent = line.match(/^[ \t]*/)?.[0].length ?? 0;
      }
      if (quote !== null && !value.includes(quote)) pendingCredential = quote;
      if (quote === null && value.trim().length === 0) pendingCredential = "";
      return "[REDACTED SENSITIVE LINE]";
    }
    return findSensitiveNames(line).length > 0 ? "[REDACTED SENSITIVE LINE]" : line;
  }).join("\n");
}
