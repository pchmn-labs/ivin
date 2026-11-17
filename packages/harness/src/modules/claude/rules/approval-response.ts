export const approvalResponseLine = (requestId: string, allow: boolean, input: unknown): string =>
  JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: allow
        ? { behavior: "allow", updatedInput: input }
        : { behavior: "deny", message: "The user denied this tool use." },
    },
  })
