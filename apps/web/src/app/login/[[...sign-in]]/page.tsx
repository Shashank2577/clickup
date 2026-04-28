import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <SignIn
        path="/login"
        routing="path"
        fallbackRedirectUrl="/"
        signUpUrl="/register"
      />
    </div>
  )
}
