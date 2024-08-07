export function abbr(val: string, partLen: number) {
  return `${val.substring(0, partLen)}...${val.substring(val.length - partLen)}`;
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(() => resolve(0), ms));
}
