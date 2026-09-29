export type JourneyExplanationStatus = 'AVAILABLE' | 'PROVIDER_UNAVAILABLE' | 'INVALID_JOURNEY' | 'NOT_CONFIGURED'

export interface JourneyExplanationResponse {
  status: JourneyExplanationStatus
  provider?: 'gemini' | 'openai' | null
  explanation: string | null
  generatedAt: string
  warning?: string
}

export interface JourneyExplanationRequest {
  originLabel: string
  destinationLabel: string
  journey: Record<string, unknown>
}
