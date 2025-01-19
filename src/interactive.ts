import { createInterface } from "node:readline/promises";
import { Impersonator } from "./impersonator.ts";

export const startRepl = async (
    _roomId: string,
    baseUrl: URL,
    user: Impersonator,
): Promise<void> => {
    let roomId = _roomId;

    const commands: Record<
        string,
        (user: Impersonator, args: string[]) => Promise<void> | void
    > = {
        exit: async (user) => {
            await user.leaveRoom(roomId);
        },
        impersonate: async (user, [mxid]) => {
            await user.impersonate(mxid);
        },
        setName: async (user, name) => {
            await user.setDisplayName(name.join(" "));
        },
        join: async (user, [room]) => {
            roomId = await Impersonator.resolveRoomAlias(baseUrl, room);

            await user.joinRoom(roomId);
        },
    };

    // Start the REPL
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
        prompt: "❯ ",
    });

    rl.on("line", async (line) => {
        if (line.startsWith("/")) {
            const [command, ...args] = line.slice(1).split(" ");

            if (commands[command]) {
                await commands[command](user, args);
            } else {
                console.info("Unknown command");
            }
        } else {
            await user.sendMessage(roomId, line);
        }

        rl.prompt();
    });

    rl.prompt();

    await new Promise((resolve) => rl.on("close", resolve));
};
