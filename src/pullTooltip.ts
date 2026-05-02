import type { BranchInfo } from "./types";

/** Explains what the Pull action will merge (tracking ref), for tooltips. */
export function describePullTooltip(headBranch: string | null | undefined, branches: BranchInfo[]): string {
  if (!headBranch) {
    return "Pull: fetch and merge using this branch’s upstream (or origin)";
  }
  const local = branches.find((b) => b.name === headBranch && !b.is_remote);
  if (local?.upstream) {
    return `Pull: merge ${local.upstream} into ${headBranch}`;
  }
  return `Pull from origin — “${headBranch}” has no upstream yet; set one (e.g. first push with upstream) for predictable sync`;
}
