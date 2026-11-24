# The file view reads a file outside the working folder, read-only, when the user opens it

An agent's answer often names a file outside the session's working folder: the user's shell config, a file in their Downloads, a sibling repository. Until now such a path opened nothing and said why under the answer, so the user had to find the file themselves.

Now a path outside the working folder, from a link, inline code or a tool row, opens in the file view like any other file, read-only. The server reads it through `file.readOutsideFile`, a read of its own that takes an absolute path and checks nothing else, and that the UI calls only when the user opens the file. The file is never listed, never followed on disk and never written: `file.readFile`, `file.listFiles`, `file.watch` and `file.writeFile` keep their working folder check. Its sub-view stores the absolute path, so a file outside the folder is read again each time it is shown. A bar over the file says it is outside the working folder and cannot be edited, with a button that shows it in the system's file manager through Electron's `shell.showItemInFolder`.

## Considered options

- **Dropping the working folder check of `file.readFile`**: rejected because the check also guards the reads ivin makes on its own, such as reading an open file again after a change on disk; a separate read keeps every other path inside the folder.
- **Opening the file in the system's default application**: rejected because `shell.openPath` runs a `.app`, a `.command` or a script, and the path comes from the agent.
- **Making the file editable**: rejected because ivin would write a file the session's folder does not hold, which the user did not choose as a project.

## Consequences

- The agent can name any file on the disk and the user can read it in ivin with a click; it was already readable by the agent itself, which runs as the user.
- Windows paths (`C:\…`) do not open yet: a link or a path is told absolute by its leading `/`.
