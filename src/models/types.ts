export interface ModelResponse {
  text: string;
  tokensUsed: number;
}

export type ModelFn = (
  system: string,
  user: string,
  opts?: { maxTokens?: number; temperature?: number },
) => Promise<ModelResponse>;