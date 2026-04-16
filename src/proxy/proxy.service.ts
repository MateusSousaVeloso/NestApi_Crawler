export class ProxyService {
  constructor(
    private proxyProvider: any,
    private httpClient: any
  ) {}

  async request({ url, method, headers, body }) {
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
      const proxy = this.proxyProvider.getProxy();

      try {
        return await this.httpClient.request({
          url,
          method,
          headers,
          body,
          proxy,
        });
      } catch (err) {
        if (!this.shouldRetry(err)) throw err;
      }
    }

    throw new Error("Request failed");
  }

  private shouldRetry(err: any) {
    const status = err?.response?.status;
    return [403, 429, 500, 502, 503].includes(status);
  }
}