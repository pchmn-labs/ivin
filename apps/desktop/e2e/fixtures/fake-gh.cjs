#!/usr/bin/env node
// Answers the gh calls of the github plugin with one open pull request that is ready to merge.
const args = process.argv.slice(2)
const print = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)

if (args[0] === "pr" && args[1] === "view") {
  print({
    state: "OPEN",
    isDraft: false,
    title: "Add the widget",
    statusCheckRollup: [
      { __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "SUCCESS" },
    ],
    reviewDecision: "APPROVED",
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    updatedAt: new Date().toISOString(),
  })
} else if (args[0] === "pr" && args[1] === "list") {
  print([])
} else if (args[0] === "repo" && args[1] === "view") {
  print({
    owner: { login: "acme" },
    defaultBranchRef: { name: "main" },
    nameWithOwner: "acme/widgets",
  })
} else if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write(
    "github.com\n  ✓ Logged in to github.com account octo (keyring)\n  - Active account: true\n",
  )
} else if (args[0] === "auth" && args[1] === "token") {
  process.stdout.write("gho_fake\n")
} else {
  print({})
}
