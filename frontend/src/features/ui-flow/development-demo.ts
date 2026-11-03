export type QueryValue = string | string[] | undefined;

export function isDevelopmentDemo(value: QueryValue, environment: string | undefined, room?: QueryValue): boolean {
  return environment === "development" && value === "1" && room === undefined;
}

export function demoFlowUrl(path: "/genre-vote" | "/genre-vote-waiting" | "/genre-result"): string {
  return `${path}?demo=1`;
}
