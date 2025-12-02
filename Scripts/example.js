// src/example.ts
import http from "k6/http";
import { sleep } from "k6";
var options = {
  vus: 2,
  duration: "1m"
};
function example_default() {
  http.get("https://test.k6.io");
  sleep(2);
}
export {
  example_default as default,
  options
};
