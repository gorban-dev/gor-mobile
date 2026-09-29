// Normalized transcript event shared by both harness adapters and all graders.
export const GUARD_MARK = "ast-index guard:";

export const ev = (kind, fields = {}) => ({ kind, ...fields });