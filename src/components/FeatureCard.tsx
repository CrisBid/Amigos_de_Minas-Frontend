import Link from 'next/link'

interface Props {
  title: string
  description: string
  href: string
}

export function FeatureCard({ title, description, href }: Props) {
  return (
    <Link href={href}>
      <div className="border rounded-2xl p-6 hover:shadow-md transition bg-white">
        <h2 className="text-xl font-semibold text-red-600">{title}</h2>
        <p className="text-gray-600 mt-2">{description}</p>
      </div>
    </Link>
  )
}
