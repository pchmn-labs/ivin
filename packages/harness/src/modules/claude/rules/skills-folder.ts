export const claudeSkillsFolder = (
  env: { readonly CLAUDE_CONFIG_DIR?: string | undefined },
  home: string,
) => `${(env.CLAUDE_CONFIG_DIR || `${home}/.claude`).replace(/\/+$/, "")}/skills`
