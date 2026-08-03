export function internalDependencyGraphValid(graph: ReadonlyMap<string, readonly string[]>, refs: ReadonlySet<string>): boolean {
  for (const [ref, dependencies] of graph) {
    if (dependencies.some((dependency) => dependency === ref || !refs.has(dependency))) return false;
  }
  const remaining = new Set(refs);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((ref) => graph.get(ref)?.every((dependency) => !remaining.has(dependency)) === true);
    if (ready.length === 0) return false;
    for (const ref of ready) remaining.delete(ref);
  }
  return true;
}
