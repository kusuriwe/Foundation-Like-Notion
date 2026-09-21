import argon2 from "argon2"

/**
 * Read a password without placing it in shell history.
 * Password を shell history に残さず読み取ります。
 */
async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString("utf8").trimEnd()
  }

  return await new Promise((resolve, reject) => {
    let password = ""
    process.stdout.write("Reader password: ")
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    const finish = (): void => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener("data", onData)
      process.stdout.write("\n")
      resolve(password)
    }

    const onData = (key: string): void => {
      if (key === "\u0003") {
        process.stdin.setRawMode(false)
        reject(new Error("Cancelled"))
        return
      }
      if (key === "\r" || key === "\n") {
        finish()
        return
      }
      if (key === "\u007f" || key === "\b") {
        password = password.slice(0, -1)
        return
      }
      password += key
    }
    process.stdin.on("data", onData)
  })
}

const password = await readPassword()
if (password.length === 0) {
  throw new Error("Password must not be empty")
}

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
})
process.stdout.write(`${hash}\n`)
