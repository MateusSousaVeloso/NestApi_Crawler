import { WebshareProvider } from "./webshare.provider";
import { HttpClient } from "./http.client";
import { ProxyService } from "./proxy.service";

export class ProxyModule {
  static create() {
    const proxyProvider = new WebshareProvider();
    const httpClient = new HttpClient();

    const proxyService = new ProxyService(
      proxyProvider,
      httpClient
    );

    return {
      proxyService,
    };
  }
}