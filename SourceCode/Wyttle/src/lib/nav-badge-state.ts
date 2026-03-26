type MenteeBadgeState = {
  connections?: number;
  mentorHub?: number;
};

type MentorBadgeState = {
  connections?: number;
  waiting?: number;
};

const menteeState: MenteeBadgeState = {};
const mentorState: MentorBadgeState = {};

const menteeListeners = new Set<(state: MenteeBadgeState) => void>();
const mentorListeners = new Set<(state: MentorBadgeState) => void>();

export function setMenteeBadgeState(next: MenteeBadgeState) {
  Object.assign(menteeState, next);
  menteeListeners.forEach((listener) => listener({ ...menteeState }));
}

export function setMentorBadgeState(next: MentorBadgeState) {
  Object.assign(mentorState, next);
  mentorListeners.forEach((listener) => listener({ ...mentorState }));
}

export function subscribeToMenteeBadgeState(listener: (state: MenteeBadgeState) => void): () => void {
  menteeListeners.add(listener);
  listener({ ...menteeState });
  return () => {
    menteeListeners.delete(listener);
  };
}

export function subscribeToMentorBadgeState(listener: (state: MentorBadgeState) => void): () => void {
  mentorListeners.add(listener);
  listener({ ...mentorState });
  return () => {
    mentorListeners.delete(listener);
  };
}
