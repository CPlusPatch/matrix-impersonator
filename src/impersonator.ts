import * as sdk from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";

logger.setLevel("ERROR");

export class Impersonator {
    private client: sdk.MatrixClient;

    public constructor(
        private baseUrl: URL,
        private mxid: string,
        private accessToken: string,
    ) {
        this.client = sdk.createClient({
            baseUrl: this.baseUrl.origin,
            accessToken: this.accessToken,
            userId: this.mxid,
        });
    }

    public static async createNew(
        baseUrl: URL,
        username: string,
        options?: Partial<{
            password: string;
            registrationToken: string;
        }>,
    ): Promise<Impersonator> {
        const client = sdk.createClient({
            baseUrl: baseUrl.origin,
        });

        // fuck this protocol
        const session = await client.http
            .authedRequest(sdk.Method.Post, "/register", undefined, {
                username,
                password: options?.password ?? "password",
            })
            .catch((e) => (e as sdk.MatrixError).data.session);

        await client
            .registerRequest({
                username,
                password: options?.password ?? "password",
                auth: options?.registrationToken
                    ? {
                          type: "m.login.registration_token",
                          token: options.registrationToken,
                          session,
                      }
                    : undefined,
            })
            .catch(() => {
                // This is supposed to fail
            });

        const { user_id, access_token } = await client.registerRequest({
            username,
            password: options?.password ?? "password",
            auth: {
                type: "m.login.dummy",
                session,
            },
        });

        if (!access_token) {
            throw new Error(
                "Failed to register user: no access token returned",
            );
        }

        return new Impersonator(baseUrl, user_id, access_token);
    }

    public async initCrypto(): Promise<void> {
        await this.client.initRustCrypto();
    }

    public async joinRoom(roomId: string): Promise<void> {
        await this.client.joinRoom(roomId);
    }

    public async impersonate(mxid: string): Promise<void> {
        const info = await this.client.getProfileInfo(mxid);

        if (info.avatar_url) {
            await this.client.setAvatarUrl(info.avatar_url);
        }

        if (info.displayname) {
            // Add zero-width spaces to prevent the display name from being
            // disambiguated with the original user's display name
            // U+00AD SOFT HYPHEN
            await this.client.setDisplayName(`­${info.displayname}­`);
        }
    }

    public async setDisplayName(displayname: string): Promise<void> {
        await this.client.setDisplayName(displayname);
    }

    public async setAvatar(avatar: URL | File): Promise<void> {
        if (avatar instanceof URL) {
            await this.client.setAvatarUrl(avatar.href);
        } else {
            const media = await this.uploadMedia(avatar);

            await this.client.setAvatarUrl(media.toString());
        }
    }

    public static async resolveRoomAlias(
        baseUrl: URL,
        alias: string,
    ): Promise<string> {
        const client = sdk.createClient({
            baseUrl: baseUrl.origin,
        });

        if (!alias.startsWith("#")) {
            return alias;
        }

        const { room_id } = await client.getRoomIdForAlias(alias);

        return room_id;
    }

    public async uploadMedia(file: File): Promise<URL> {
        const content = await this.client.uploadContent(file);

        return new URL(content.content_uri);
    }

    public async sendMessage(roomId: string, message: string): Promise<void> {
        await this.client.sendTextMessage(roomId, message);
    }

    public async leaveRoom(roomId: string): Promise<void> {
        await this.client.leave(roomId);
    }

    public async deleteAccount(): Promise<void> {
        await this.client.deactivateAccount(undefined);
    }
}
