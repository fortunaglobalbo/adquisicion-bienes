// Server configuration accepts both the original names and README aliases.
export const engineUrl = (process.env.VPS_DOCX_ENGINE_URL || process.env.VPS_ENGINE_URL || "http://85.31.230.163:8080").replace(/\/+$/, "");
export const ragUrl = (process.env.ANYTHINGLLM_BASE_URL || process.env.ANYTHINGLLM_URL || "http://85.31.230.163:3005").replace(/\/+$/, "").replace(/\/api\/v1$/, "") + "/api/v1";
