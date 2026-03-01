/**
 * Guard für Agent-Ingest-Fetches (127.0.0.1:7242).
 * Nur wenn NEXT_PUBLIC_AGENT_INGEST_ENABLED === 'true', werden Aufrufe ausgeführt.
 * In Produktion standardmäßig keine Aufrufe.
 */
export function shouldEmitAgentIngest(): boolean {
  return process.env.NEXT_PUBLIC_AGENT_INGEST_ENABLED === 'true';
}
