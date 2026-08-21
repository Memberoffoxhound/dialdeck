import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalScreenTracks,
  type LocalTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication
} from "livekit-client";
import { publishOptions, screenShareConstraints } from "./media";

export type Peer = {
  id: string;
  name: string;
  hasAudio: boolean;
  hasVideo: boolean;
};

export function usePartyLine(device: string) {
  const roomRef = useRef<Room | null>(null);
  const localTracks = useRef<LocalTrack[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState("idle");

  const refreshPeers = useCallback((room: Room) => {
    const list: Peer[] = [];
    room.remoteParticipants.forEach((p) => {
      list.push({
        id: p.identity,
        name: p.name || p.identity.slice(0, 8),
        hasAudio: [...p.trackPublications.values()].some(
          (pub) => pub.kind === Track.Kind.Audio && pub.isSubscribed
        ),
        hasVideo: [...p.trackPublications.values()].some(
          (pub) => pub.kind === Track.Kind.Video && pub.isSubscribed
        )
      });
    });
    setPeers(list);
  }, []);

  const attachTrack = useCallback((track: RemoteTrack, identity: string) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.dataset.peer = identity;
      el.autoplay = true;
      document.body.appendChild(el);
    }
    if (track.kind === Track.Kind.Video) {
      const stage = document.getElementById("dialdeck-stage");
      const el = track.attach();
      el.dataset.peer = identity;
      el.playsInline = true;
      el.autoplay = true;
      el.muted = true;
      el.style.width = "100%";
      el.style.borderRadius = "12px";
      el.style.background = "#000";
      stage?.appendChild(el);
    }
  }, []);

  const detachIdentity = useCallback((identity: string) => {
    document.querySelectorAll(`[data-peer="${CSS.escape(identity)}"]`).forEach((node) => {
      node.remove();
    });
  }, []);

  const leave = useCallback(async () => {
    for (const t of localTracks.current) {
      t.stop();
    }
    localTracks.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.remoteParticipants.forEach((p) => detachIdentity(p.identity));
      await room.disconnect();
    }
    setLive(false);
    setPeers([]);
    setStatus("idle");
  }, [detachIdentity]);

  const join = useCallback(async () => {
    setError("");
    setStatus("connecting");
    await leave();
    const meta = await fetch("/api/meta", { credentials: "include" }).then((r) => r.json());
    const tokenRes = await fetch("/api/livekit/token", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "party-line", publish: true })
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenBody.error ?? "token failed");

    const url =
      meta.livekitUrl ??
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/rtc`;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: publishOptions()
    });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      attachTrack(track, p.identity);
      refreshPeers(room);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => {
      track.detach().forEach((el) => el.remove());
      detachIdentity(p.identity);
      refreshPeers(room);
    });
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      detachIdentity(p.identity);
      refreshPeers(room);
    });
    room.on(RoomEvent.Disconnected, () => {
      setLive(false);
      setStatus("idle");
    });

    await room.connect(url, tokenBody.token);

    if (device === "pc") {
      try {
        const screens = await createLocalScreenTracks({
          audio: true,
          resolution: {
            width: screenShareConstraints().video.width.ideal,
            height: screenShareConstraints().video.height.ideal,
            frameRate: 60
          }
        });
        for (const t of screens) {
          localTracks.current.push(t);
          await room.localParticipant.publishTrack(t, publishOptions());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "screen share blocked");
      }
    } else {
      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      localTracks.current.push(mic);
      await room.localParticipant.publishTrack(mic);
    }

    refreshPeers(room);
    setLive(true);
    setStatus("live");
  }, [attachTrack, detachIdentity, device, leave, refreshPeers]);

  const setPeerVolume = useCallback((id: string, pct: number) => {
    const room = roomRef.current;
    const p = room?.remoteParticipants.get(id);
    if (!p) {
      document.querySelectorAll<HTMLMediaElement>(`audio[data-peer="${CSS.escape(id)}"]`).forEach((el) => {
        el.volume = pct / 100;
      });
      return;
    }
    p.audioTrackPublications.forEach((pub) => {
      pub.audioTrack?.setVolume(pct / 100);
    });
  }, []);

  const setMasterOut = useCallback((pct: number) => {
    document.querySelectorAll<HTMLMediaElement>("audio[data-peer]").forEach((el) => {
      el.volume = pct / 100;
    });
  }, []);

  useEffect(() => {
    return () => {
      void leave();
    };
  }, [leave]);

  return { live, error, status, peers, join, leave, setPeerVolume, setMasterOut };
}
