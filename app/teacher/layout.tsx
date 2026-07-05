export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-teacher bg-teacher-paper min-h-screen">
      {children}
    </div>
  )
}
