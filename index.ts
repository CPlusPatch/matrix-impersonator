import { input, select } from "@inquirer/prompts";
import ora from "ora";
import { Impersonator } from "./src/impersonator.ts";
import { startRepl } from "./src/interactive.ts";

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

const roomId = await Impersonator.resolveRoomAlias(
    baseUrl,
    await input({
        message: "Room ID:",
        default: "#spamtest:cpluspatch.dev",
    }),
);

const ora2 = ora("Joining room").start();

await newUser.joinRoom(roomId);

ora2.succeed("Joined room");

await startRepl(roomId, baseUrl, newUser);
