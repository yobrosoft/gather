const WAYMARK_PROJECT = "project-60413c08-2fb7-476d-803";

export function assertSafeFirestoreProject(projectId: string) {
  if (projectId === WAYMARK_PROJECT || projectId.toLowerCase() === "waymark") {
    throw new Error("Refusing to use the Waymark Google Cloud project for Gather.");
  }
}
