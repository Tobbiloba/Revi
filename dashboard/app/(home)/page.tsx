import FeaturesSection from '@/app/(home)/_components/features'
import Hero from '@/app/(home)/_components/hero'
import FooterSection from '@/components/footer'
import ContentSection from '@/components/content'


const Page = () => {
  return (
    <div>
      <Hero />
      <ContentSection />
      <FeaturesSection />
      <FooterSection />

    </div>
  )
}

export default Page
