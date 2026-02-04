import { signIn } from "next-auth/react";

export default function InstagramLoginButton() {
  return (
    <button onClick={() => signIn("instagram")}>Sign in with Instagram</button>
  );
}
