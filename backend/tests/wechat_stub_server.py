"""可控的 weixin-msg-service 测试替身(绝不真发微信)。

- POST /api/send:
    若 /tmp/wechat_stub_active 存在 -> {"ok":true},并把消息追加到 /tmp/wechat_stub_received.log
    否则 -> 400 {"ok":false,"error":"需要先用微信给 bot 发一条消息以激活通知通道"}
- GET /api/health -> {"ok":true}
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

ACTIVE_FLAG = "/tmp/wechat_stub_active"
RECEIVED_LOG = "/tmp/wechat_stub_received.log"
INACTIVE_ERROR = "需要先用微信给 bot 发一条消息以激活通知通道"


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):  # 静音
        pass

    def do_GET(self):
        if self.path == "/api/health":
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "接口不存在"})

    def do_POST(self):
        if self.path != "/api/send":
            return self._send(404, {"error": "接口不存在"})
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"ok": False, "error": "Invalid JSON"})
        text = data.get("text")
        if not text:
            return self._send(400, {"ok": False, "error": "缺少 text"})

        if os.path.exists(ACTIVE_FLAG):
            with open(RECEIVED_LOG, "a", encoding="utf-8") as f:
                f.write(text + "\n----\n")
            return self._send(200, {"ok": True})
        return self._send(400, {"ok": False, "error": INACTIVE_ERROR})


if __name__ == "__main__":
    # 每次启动清空已接收记录
    if os.path.exists(RECEIVED_LOG):
        os.remove(RECEIVED_LOG)
    HTTPServer(("127.0.0.1", 15099), H).serve_forever()
