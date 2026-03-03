export type UserLike = {
  username?: string;
  profile?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export function getUserDisplayName(user: UserLike): string {
  const p = user.profile;

  if (p?.displayName) return p.displayName;

  if (p?.firstName && p?.lastName) {
    return `${p.firstName} ${p.lastName}`;
  }

  if (p?.firstName) return p.firstName;

  if (user.username) return user.username;

  return "Roommate";
}

export function matchItemToUserLike(m: {
  username?: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): UserLike {
  return {
    username: m.username,
    profile: {
      displayName: m.displayName,
      firstName: m.firstName,
      lastName: m.lastName,
    },
  };
}

export function shortlistedUserToUserLike(u: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
}): UserLike {
  return {
    username: u.username,
    profile: {
      displayName: u.displayName ?? null,
      firstName: u.firstName,
      lastName: u.lastName,
    },
  };
}

export function chatMessageSenderToUserLike(m: {
  senderDisplayName?: string | null;
  senderFirstName?: string | null;
  senderLastName?: string | null;
}): UserLike {
  return {
    profile: {
      displayName: m.senderDisplayName ?? null,
      firstName: m.senderFirstName ?? null,
      lastName: m.senderLastName ?? null,
    },
  };
}

export function authUserToUserLike(user: {
  username?: string;
  profile?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}) {
  return {
    username: user.username,
    profile: user.profile
      ? {
          displayName: user.profile.displayName,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
        }
      : null,
  };
}
