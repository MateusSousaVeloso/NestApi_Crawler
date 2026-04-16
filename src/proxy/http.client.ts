import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

export class HttpClient {
  async request({ url, method, headers, body, proxy }) {
    const agent = new HttpsProxyAgent(proxy);

    return axios({
      url,
      method,
      headers,
      data: body,
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
    });
  }
}