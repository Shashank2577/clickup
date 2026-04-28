import { SignUp } from '@clerk/nextjs'

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <SignUp
        routing="hash"
        afterSignUpUrl="/"
        signInUrl="/login"
      />
    </div>
  )
}
