import { proxyConfig } from "./proxy.config";

export class WebshareProvider {
  getProxy() {
    return `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`;
  }
}