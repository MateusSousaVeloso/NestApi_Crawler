export const proxyConfig = {
  username: process.env.BRIGHTDATA_USERNAME!,
  password: process.env.BRIGHTDATA_PASSWORD!,
  host: process.env.BRIGHTDATA_HOST!,
  port: Number(process.env.BRIGHTDATA_PORT!),
};