export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-student bg-student-cream min-h-screen">
      {children}
    </div>
  )
}
