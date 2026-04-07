type User = {
    id: number;
    name: string;
    token: string;
};

export function login(username: string, password: string): User {
    console.log("🔐 Authenticating user...");

    // fake auth
    return {
        id: 1,
        name: username,
        token: "fake-jwt-token"
    };
}

export function validateToken(token: string): boolean {
    return token === "fake-jwt-token";
}
