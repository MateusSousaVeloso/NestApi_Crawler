import { proxyConfig } from "./proxy.config";

export class BrightDataProvider {
  getProxy() {
    const session = Math.random().toString(36).substring(7);

    const { username, password, host, port } = proxyConfig;

    return `http://${username}-session-${session}:${password}@${host}:${port}`;
  }
}