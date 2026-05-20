export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  handle: string;
  avatarSlot: string;
  avatarAsset?: string;
  solved: number;
  xp: number;
  isMe?: boolean;
};

export const MOCK_TOP_PLAYERS: LeaderboardEntry[] = [
  {
    rank: 1,
    playerId: "devmaster",
    handle: "DevMaster",
    avatarSlot: "avatar/devmaster",
    solved: 682,
    xp: 12540,
  },
  {
    rank: 2,
    playerId: "code-ninja",
    handle: "CodeNinja",
    avatarSlot: "avatar/code-ninja",
    solved: 512,
    xp: 11230,
    isMe: true,
  },
  {
    rank: 3,
    playerId: "sharpy",
    handle: "SharpY",
    avatarSlot: "avatar/sharpy",
    solved: 493,
    xp: 10870,
  },
  {
    rank: 4,
    playerId: "bytebender",
    handle: "ByteBender",
    avatarSlot: "avatar/bytebender",
    solved: 459,
    xp: 9760,
  },
  {
    rank: 5,
    playerId: "nullpointer",
    handle: "NullPointer",
    avatarSlot: "avatar/nullpointer",
    solved: 412,
    xp: 8918,
  },
];
