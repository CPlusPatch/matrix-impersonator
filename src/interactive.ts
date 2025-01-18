import ora from "ora";
import { input, select } from "@inquirer/prompts";
import { Impersonator } from "./impersonator.ts";
import { createInterface } from "node:readline/promises";

const mode: "impersonate" | "default" = await select({
    message: "Choose a mode",
    default: "impersonate",
    choices: [
        { name: "Impersonate a user", value: "impersonate" },
        { name: "Default", value: "default" },
    ],
});

const uncleanUrl = await input({
    message: "Homeserver URL",
    default: "cpluspatch.dev",
});

const baseUrl = new URL(
    uncleanUrl.startsWith("http") ? uncleanUrl : `https://${uncleanUrl}`,
);

const spinner = ora("Registering user").start();

const username = `dork${Math.floor(Math.random() * 10000).toString()}`;
const newUser = await Impersonator.createNew(baseUrl, username, {
    registrationToken: Bun.env.REGISTRATION_TOKEN,
});

spinner.succeed("User registered");

if (mode === "impersonate") {
    const mxid = await input({
        message: "MXID of impersonated user:",
    });

    await newUser.impersonate(mxid);
}

let roomId = await Impersonator.resolveRoomAlias(
    baseUrl,
    await input({
        message: "Room ID:",
        default: "#spamtest:cpluspatch.dev",
    }),
);

const ora2 = ora("Joining room").start();

await newUser.joinRoom(roomId);

ora2.succeed("Joined room");

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
            await commands[command](newUser, args);
        } else {
            console.info("Unknown command");
        }
    } else {
        await newUser.sendMessage(roomId, line);
    }

    rl.prompt();
});

rl.prompt();

await new Promise((resolve) => rl.on("close", resolve));
