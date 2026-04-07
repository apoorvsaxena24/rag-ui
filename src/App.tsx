import { Layout } from './components/Layout';
import { Upload } from './components/Upload';
import { UnreadableContentStep } from './components/UnreadableContentStep';
import { TerminologyStep } from './components/TerminologyStep';
import { ConflictStep } from './components/ConflictStep';
import { FAQStep } from './components/FAQStep';
import { FinalReviewStep } from './components/FinalReviewStep';
import { useStore } from './store/useStore';

function App() {
  const { currentStep } = useStore();

  return (
    <Layout>
      {currentStep === 0 && <Upload />}
      {currentStep === 1 && <UnreadableContentStep />}
      {currentStep === 2 && <TerminologyStep />}
      {currentStep === 3 && <ConflictStep />}
      {currentStep === 4 && <FAQStep />}
      {currentStep === 5 && <FinalReviewStep />}
    </Layout>
  );
}

export default App;
