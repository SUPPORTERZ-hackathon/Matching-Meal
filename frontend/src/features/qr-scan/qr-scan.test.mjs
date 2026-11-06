import "../genre-voting-api/test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import sharp from "sharp";
const { parseInviteInput, QR_SCAN } = await import("./qr-scan-data.ts");
const { createCameraSession } = await import("./camera-session.ts");
const { createQrDecoder } = await import("./qr-decoder.ts");

const origin = "https://meal.example.test", url = origin + "/j/7K9M2QXR";
const flush = () => new Promise(resolve => setImmediate(resolve));
const problem = name => new DOMException("not displayed", name);
function makeStream(id = "rear") {
  const track = Object.assign(new EventTarget(), { stopped: 0, getSettings: () => ({ deviceId: id }), stop() { this.stopped++; } });
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}
function fixture(overrides = {}) {
  const stream = makeStream(), calls = [], states = [], paths = [], timers = new Map(), delays = [], env = { visible: true };
  let sequence = 0, clears = 0;
  const video = { srcObject: null, videoWidth: 1280, videoHeight: 720, readyState: 4, plays: 0, pauses: 0, async play() { this.plays++; }, pause() { this.pauses++; } };
  const media = {
    getUserMedia: async constraints => { calls.push(constraints); return stream; },
    enumerateDevices: async () => [{ kind: "videoinput", deviceId: "rear" }, { kind: "videoinput", deviceId: "front" }],
  };
  const dependencies = {
    origin, secure: true, visible: () => env.visible, media,
    loadDecoder: async () => () => undefined,
    frame: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }), clearFrame: () => { clears++; },
    schedule: (callback, delay) => { delays.push(delay); timers.set(++sequence, callback); return sequence; }, cancel: timer => timers.delete(timer),
    onState: state => states.push(state), onInvite: path => paths.push(path), ...overrides,
  };
  const camera = createCameraSession(dependencies);
  return { camera, dependencies, stream, calls, states, paths, timers, delays, env, video, get clears() { return clears; }, get state() { return states.at(-1); },
    tick() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } };
}

test("同一originの招待だけを正規化し、localhost/HTTPSも別々に検証する", () => {
  for (const input of [url, ` ${url} `, origin + "/j/7k9m2qxr/"]) assert.deepEqual(parseInviteInput(input, origin), { ok: true, path: "/j/7K9M2QXR" });
  assert(parseInviteInput("http://localhost:3000/j/7K9M2QXR", "http://localhost:3000").ok);
  for (const foreign of ["https://evil.test", "https://meal.example.test.evil.test", "http://meal.example.test", "https://meal.example.test:444", "http://localhost:3000", "https://other.trycloudflare.com"]) {
    assert.equal(parseInviteInput(foreign + "/j/7K9M2QXR", origin).issue.code, "foreign_origin");
  }
});

test("不正コード・認証情報・query/hash・スクリプト・巨大入力を遷移先にしない", () => {
  for (const input of ["", "7K9M2QXR", "/j/7K9M2QXR", "//meal.example.test/j/7K9M2QXR", "javascript:alert(1)", "data:text/plain,hello", "https://user:pass@meal.example.test/j/7K9M2QXR", origin + "/j/7K9M2QX0", origin + "/j/2481", origin + "/j/%37K9M2QXR", url + "/extra", url + "?", url + "#", url + "?token=private", url + "#fragment", url + "\n", url.replace("/j/", "\\j\\"), "x".repeat(QR_SCAN.maxUrlLength + 1)]) {
    assert.equal(parseInviteInput(input, origin).ok, false, input.slice(0, 70));
  }
});

test("ユーザー起動で背面ideal・音声なし、未検出は継続し停止は全リソースを解放", async () => {
  const f = fixture();
  await f.camera.start(f.video); await flush();
  assert.equal(f.state.phase, "scanning"); assert.equal(f.state.canSwitch, true);
  assert.equal(f.calls[0].audio, false); assert.deepEqual(f.calls[0].video.facingMode, { ideal: "environment" });
  assert.equal(f.video.srcObject, f.stream); assert.equal(f.video.plays, 1);
  await f.camera.start(f.video); assert.equal(f.calls.length, 1);
  f.tick(); assert.equal(f.delays.at(-1), QR_SCAN.frameInterval);
  const lateFrame = f.timers.values().next().value;
  f.camera.stop(); lateFrame();
  assert.equal(f.stream.track.stopped, 1); assert.equal(f.video.srcObject, null); assert.equal(f.timers.size, 0); assert(f.clears > 0);
  assert.equal(f.state.phase, "idle");
});

test("非HTTPS・非対応ではカメラを要求しない", async () => {
  const insecure = fixture({ secure: false }); await insecure.camera.start(insecure.video);
  assert.equal(insecure.state.issue.code, "insecure"); assert.equal(insecure.calls.length, 0);
  const unsupported = fixture({ media: undefined }); await unsupported.camera.start(unsupported.video);
  assert.equal(unsupported.state.issue.code, "unsupported");
});

test("拒否・機器なし・ビジーを区別し、不要な取得再試行をしない", async () => {
  for (const [name, code] of [["NotAllowedError", "denied"], ["SecurityError", "denied"], ["NotFoundError", "not_found"], ["NotReadableError", "busy"], ["AbortError", "busy"], ["OtherError", "camera_failed"]]) {
    let calls = 0;
    const f = fixture({ media: { getUserMedia: async () => { calls++; throw problem(name); }, enumerateDevices: async () => [] } });
    await f.camera.start(f.video); assert.equal(f.state.issue.code, code); assert.equal(calls, 1); assert.equal(f.state.pending, false); assert.equal(f.timers.size, 0);
  }
});

test("制約不適合だけ標準カメラへ1回フォールバックし、失敗後も手動で再試行可能", async () => {
  const stream = makeStream(), requests = [];
  const f = fixture({ media: { getUserMedia: async c => { requests.push(c); if (requests.length === 1) throw problem("OverconstrainedError"); return stream; }, enumerateDevices: async () => [] } });
  await f.camera.start(f.video);
  assert.equal(requests.length, 2); assert.deepEqual(requests[1], { audio: false, video: true }); assert.equal(f.state.phase, "scanning");
  f.camera.stop(); await f.camera.start(f.video); assert.equal(requests.length, 3); f.camera.dispose();
});

test("切替は旧trackを止めてから別deviceIdを取得し、消失した切替先は標準へ戻す", async () => {
  const rear = makeStream("rear"), front = makeStream("front"), requests = [];
  const media = { getUserMedia: async c => {
    requests.push(c);
    if (requests.length === 1) return rear;
    assert.equal(rear.track.stopped, 1);
    if (requests.length === 2) { assert.equal(c.video.deviceId.exact, "front"); throw problem("NotFoundError"); }
    assert.equal(c.video, true); return front;
  }, enumerateDevices: async () => [{ kind: "videoinput", deviceId: "rear" }, { kind: "videoinput", deviceId: "front" }] };
  const f = fixture({ media }); await f.camera.start(f.video); await flush();
  f.camera.switchCamera(f.video); await flush();
  assert.equal(requests.length, 3); assert.equal(f.state.phase, "scanning"); assert.equal(f.video.srcObject, front);
  f.camera.dispose(); assert.equal(front.track.stopped, 1);
});

test("許可待ちの連打・中止・再起動を制御し、後着のstreamは即座に止める", async () => {
  let resolvePermission, calls = 0;
  const old = makeStream(), replacement = makeStream();
  const f = fixture({ media: { getUserMedia: async () => ++calls === 1 ? new Promise(resolve => { resolvePermission = resolve; }) : replacement, enumerateDevices: async () => [] } });
  const initial = f.camera.start(f.video); await flush();
  await f.camera.start(f.video); assert.equal(calls, 1);
  f.camera.stop("paused"); await f.camera.start(f.video); assert.equal(calls, 1); assert.equal(f.state.pending, true);
  resolvePermission(old); await initial;
  assert.equal(old.track.stopped, 1); assert.equal(f.video.srcObject, null); assert.equal(f.state.phase, "paused"); assert.equal(f.state.pending, false);
  await f.camera.start(f.video); assert.equal(calls, 2); assert.equal(f.state.phase, "scanning"); f.camera.dispose();
});

test("破棄中の遅延ロードはカメラを開始せず、遅延許可も旧streamだけを解放する", async () => {
  let loaded;
  const f = fixture({ loadDecoder: () => new Promise(resolve => { loaded = resolve; }) });
  const starting = f.camera.start(f.video), count = f.states.length;
  f.camera.dispose(); loaded(() => undefined); await starting;
  assert.equal(f.calls.length, 0); assert.equal(f.states.length, count);
  let granted;
  const late = makeStream(), g = fixture({ media: { getUserMedia: () => new Promise(resolve => { granted = resolve; }), enumerateDevices: async () => [] } });
  const pending = g.camera.start(g.video); await flush(); g.camera.dispose();
  granted(late); await pending; assert.equal(late.track.stopped, 1); assert.equal(g.video.srcObject, null);
});

test("有効なQRは停止後一度だけ参加画面へ渡し、後着検出や再入力では増えない", async t => {
  let network = 0; t.mock.method(globalThis, "fetch", async () => { network++; throw new Error("must not submit"); });
  const f = fixture({ loadDecoder: async () => () => url }); await f.camera.start(f.video);
  const late = f.timers.values().next().value; f.tick(); late(); f.camera.accept(url);
  assert.deepEqual(f.paths, ["/j/7K9M2QXR"]); assert.equal(f.stream.track.stopped, 1); assert.equal(f.video.srcObject, null); assert.equal(f.timers.size, 0); assert.equal(network, 0);
});

test("不正QRはエラーと停止になり、外部遷移・参加登録を行わない", async () => {
  for (const [value, code] of [["not an invite", "invalid_invite"], ["https://evil.test/j/7K9M2QXR", "foreign_origin"]]) {
    const f = fixture({ loadDecoder: async () => () => value }); await f.camera.start(f.video); f.tick();
    assert.equal(f.state.issue.code, code); assert.equal(f.stream.track.stopped, 1); assert.equal(f.paths.length, 0); assert.equal(f.timers.size, 0);
  }
});

test("非表示相当の停止・track終了・再生/解析失敗はカメラとタイマーを残さない", async () => {
  const f = fixture(); await f.camera.start(f.video); f.env.visible = false; f.camera.stop("paused"); assert.equal(f.state.phase, "paused"); assert.equal(f.stream.track.stopped, 1); assert.equal(f.timers.size, 0);
  const ended = fixture(); await ended.camera.start(ended.video); ended.stream.track.dispatchEvent(new Event("ended")); assert.equal(ended.state.issue.code, "camera_ended"); assert.equal(ended.stream.track.stopped, 1);
  const play = fixture(); play.video.play = async () => { throw new Error("cannot play"); }; await play.camera.start(play.video); assert.equal(play.state.issue.code, "video_failed"); assert.equal(play.stream.track.stopped, 1);
  const decode = fixture({ loadDecoder: async () => { throw new Error("cannot load"); } }); await decode.camera.start(decode.video); assert.equal(decode.state.issue.code, "decoder_failed"); assert.equal(decode.calls.length, 0);
  const frame = fixture({ frame: () => { throw new Error("canvas failed"); } }); await frame.camera.start(frame.video); frame.tick(); assert.equal(frame.state.issue.code, "decoder_failed"); assert.equal(frame.stream.track.stopped, 1);
});

test("URL貼り付けは許可不要で使え、許可待ちでも成功後の遅延streamを止める", async () => {
  const manual = fixture({ secure: false, media: undefined }); manual.camera.accept(url); assert.deepEqual(manual.paths, ["/j/7K9M2QXR"]);
  let granted; const old = makeStream(), f = fixture({ media: { getUserMedia: () => new Promise(resolve => { granted = resolve; }), enumerateDevices: async () => [] } });
  const pending = f.camera.start(f.video); await flush(); f.camera.accept(url);
  assert.equal(f.state.phase, "success"); assert.equal(f.state.pending, true);
  granted(old); await pending;
  assert.equal(old.track.stopped, 1); assert.deepEqual(f.paths, ["/j/7K9M2QXR"]);
});

test("デバイス列挙が未対応/失敗でも読取は継続し、非表示なら次フレームで確実に停止", async () => {
  for (const enumerateDevices of [undefined, () => { throw new Error("not available"); }]) {
    const stream = makeStream(), f = fixture({ media: { getUserMedia: async () => stream, enumerateDevices } });
    await f.camera.start(f.video); await flush(); assert.equal(f.state.phase, "scanning"); assert.equal(f.state.canSwitch, false);
    f.env.visible = false; f.tick(); assert.equal(f.state.phase, "paused"); assert.equal(stream.track.stopped, 1); assert.equal(f.timers.size, 0);
  }
});

test("既存生成方式のロゴ入りQRを実ZXingで解析でき、空画像は通常の未検出になる", async () => {
  const logo = await readFile(new URL("../../../public/genre-vote/icons/icon-192.png", import.meta.url));
  const decode = createQrDecoder();
  for (const size of [192, 320]) {
    const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: url, size, marginSize: 4, level: "H", bgColor: "#FFFFFF", fgColor: "#272321", imageSettings: { src: `data:image/png;base64,${logo.toString("base64")}`, width: 22, height: 22, excavate: true } }));
    const { data, info } = await sharp(Buffer.from(svg)).flatten({ background: "#FFFFFF" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decode({ data: new Uint8ClampedArray(data), width: info.width, height: info.height }), url);
  }
  assert.equal(decode({ data: new Uint8ClampedArray(96 * 96 * 4).fill(255), width: 96, height: 96 }), undefined);
});
