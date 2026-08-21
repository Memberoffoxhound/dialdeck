import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  type LocalTrack,
  type RemoteParticipant,
  type RemoteTrack
} from "livekit-client";
import { displayConstraints, publishOptions } from "./media";
import { notify } from "./sounds";

export type Peer = {
  id: string;
  name: string;
  local?: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
};

export type DeviceList = {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  outs: MediaDeviceInfo[];
};

export function usePartyLine(device: string) {
  const roomRef = useRef<Room | null>(null);
  const localTracks = useRef<LocalTrack[]>([]);
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState("idle");
  const [devices, setDevices] = useState<DeviceList>({ mics: [], cams: [], outs: [] });
  const [micId, setMicId] = useState("");
  const [camId, setCamId] = useState("");
  const [outId, setOutId] = useState("");

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices({
      mics: all.filter((d) => d.kind === "audioinput"),
      cams: all.filter((d) => d.kind === "videoinput"),
      outs: all.filter((d) => d.kind === "audiooutput")
    });
  }, []);

  const refreshPeers = useCallback((room: Room) => {
    const list: Peer[] = [];
    const me = room.localParticipant;
    if (me) {
      list.push({
        id: me.identity || "local",
        name: "You",
        local: true,
        hasAudio: [...me.audioTrackPublications.values()].some((p) => !p.isMuted),
        hasVideo: [...me.videoTrackPublications.values()].some((p) => !!p.track)
      });
    }
    room.remoteParticipants.forEach((p) => {
      list.push({
        id: p.identity,
        name: p.name || p.identity.slice(0, 8),
        hasAudio: [...p.trackPublications.values()].some((pub) => pub.kind === Track.Kind.Audio && pub.isSubscribed),
        hasVideo: [...p.trackPublications.values()].some((pub) => pub.kind === Track.Kind.Video && pub.isSubscribed)
      });
    });
    setPeers(list);
  }, []);

  const bindVideo = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (!el) {
      videoEls.current.delete(id);
      return;
    }
    videoEls.current.set(id, el);
    const room = roomRef.current;
    if (!room) return;
    if (id === (room.localParticipant.identity || "local")) {
      room.localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.track) pub.track.attach(el);
      });
      el.muted = true;
      el.volume = 0;
      return;
    }
    room.remoteParticipants.get(id)?.videoTrackPublications.forEach((pub) => {
      if (pub.track) pub.track.attach(el);
    });
    el.muted = true;
  }, []);

  const attachRemote = useCallback(
    (track: RemoteTrack, identity: string, name: string) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.dataset.peer = identity;
        el.autoplay = true;
        document.body.appendChild(el);
        if (outId && "setSinkId" in el) {
          void (el as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(outId);
        }
        return;
      }
      notify(`${name} is sharing`, "Video landed on the stage", "share");
      const el = videoEls.current.get(identity);
      if (el) {
        track.attach(el);
        el.muted = true;
      }
    },
    [outId]
  );

  const leave = useCallback(async () => {
    for (const t of localTracks.current) t.stop();
    localTracks.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      document.querySelectorAll("audio[data-peer]").forEach((n) => n.remove());
      await room.disconnect();
    }
    setLive(false);
    setPeers([]);
    setStatus("idle");
  }, []);

  const connect = useCallback(async () => {
    if (roomRef.current?.state === "connected") return roomRef.current;
    setError("");
    setStatus("connecting");
    const tokenRes = await fetch("/api/livekit/token", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "party-line", publish: true })
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenBody.error ?? "token failed");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.hostname}:7880`;

    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        /* ignore */
      }
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: publishOptions(),
      stopLocalTrackOnUnpublish: true
    });
    roomRef.current = room;
    room.on(RoomEvent.TrackSubscribed, (track, _p, p: RemoteParticipant) => {
      attachRemote(track, p.identity, p.name || p.identity);
      refreshPeers(room);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    room.on(RoomEvent.ParticipantConnected, (p) => {
      notify(`${p.name || "Someone"} joined`, "On the party line", "join");
      refreshPeers(room);
    });
    room.on(RoomEvent.ParticipantDisconnected, () => refreshPeers(room));
    room.on(RoomEvent.Disconnected, () => {
      setLive(false);
      setStatus("idle");
    });
    await room.connect(url, tokenBody.token, { autoSubscribe: true });
    setLive(true);
    setStatus("live");
    refreshPeers(room);
    return room;
  }, [attachRemote, refreshPeers]);

  const publishLocal = useCallback(
    async (tracks: LocalTrack[]) => {
      try {
        const room = await connect();
        if (room.state !== "connected") {
          throw new Error("voice server is not connected");
        }
        for (const t of tracks) {
          localTracks.current.push(t);
          await room.localParticipant.publishTrack(t, publishOptions());
        }
        refreshPeers(room);
      } catch (e) {
        setError(e instanceof Error ? e.message : "publish failed");
        throw e;
      }
    },
    [connect, refreshPeers]
  );

  const joinMic = useCallback(async () => {
    try {
      const mic = await createLocalAudioTrack({
        deviceId: micId || undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      await publishLocal([mic]);
      await refreshDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic failed");
    }
  }, [micId, publishLocal, refreshDevices]);

  const shareCamera = useCallback(async () => {
    try {
      const cam = await createLocalVideoTrack({
        deviceId: camId || undefined,
        resolution: { width: 1280, height: 720, frameRate: 30 }
      });
      await publishLocal([cam]);
      await refreshDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "camera failed");
    }
  }, [camId, publishLocal, refreshDevices]);

  const shareDisplay = useCallback(
    async (surface: "monitor" | "window") => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints(surface));
        const tracks: LocalTrack[] = [];
        for (const raw of stream.getVideoTracks()) tracks.push(new LocalVideoTrack(raw, undefined, false));
        for (const raw of stream.getAudioTracks()) tracks.push(new LocalAudioTrack(raw, undefined, false));
        await publishLocal(tracks);
      } catch (e) {
        setError(e instanceof Error ? e.message : "share cancelled");
      }
    },
    [publishLocal]
  );

  const setOutput = useCallback(async (id: string) => {
    setOutId(id);
    document.querySelectorAll<HTMLMediaElement>("audio[data-peer]").forEach((el) => {
      if ("setSinkId" in el) void (el as HTMLMediaElement & { setSinkId: (s: string) => Promise<void> }).setSinkId(id);
    });
  }, []);

  const setPeerVolume = useCallback((id: string, pct: number) => {
    roomRef.current?.remoteParticipants.get(id)?.audioTrackPublications.forEach((pub) => {
      pub.audioTrack?.setVolume(pct / 100);
    });
    document.querySelectorAll<HTMLMediaElement>(`audio[data-peer="${CSS.escape(id)}"]`).forEach((el) => {
      el.volume = pct / 100;
    });
  }, []);

  const setMasterOut = useCallback((pct: number) => {
    document.querySelectorAll<HTMLMediaElement>("audio[data-peer]").forEach((el) => {
      el.volume = pct / 100;
    });
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      void leave();
    };
  }, [leave, refreshDevices]);

  return {
    live,
    error,
    status,
    peers,
    devices,
    micId,
    camId,
    outId,
    setMicId,
    setCamId,
    setOutput,
    joinMic,
    shareCamera,
    shareScreen: () => shareDisplay("monitor"),
    shareWindow: () => shareDisplay("window"),
    leave,
    bindVideo,
    setPeerVolume,
    setMasterOut,
    deviceHint: device
  };
}
