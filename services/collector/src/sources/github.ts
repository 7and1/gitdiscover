import { Octokit } from "@octokit/rest";

export function createGitHubClient(token?: string) {
  return new Octokit({
    ...(token ? { auth: token } : {}),
    userAgent: "gitdiscover-collector/1.0",
    request: {
      timeout: 30_000,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  });
}

export async function getRepo(octokit: Octokit, fullName: string) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) throw new Error(`Invalid fullName: ${fullName}`);

  const res = await octokit.repos.get({
    owner,
    repo
  });
  return res.data;
}

export async function getUser(octokit: Octokit, login: string) {
  const res = await octokit.users.getByUsername({ username: login });
  return res.data;
}
