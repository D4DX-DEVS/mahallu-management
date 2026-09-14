import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { registrationService, Certificate } from '@/services/registrationService';
import { formatDate, toTitleCase } from '@/utils/format';
import { LOGO_PATH, BRAND_NAME } from '@/constants/theme';

export default function VerifyCertificate() {
  const { certificateNo } = useParams<{ certificateNo: string }>();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (certificateNo) {
      verifyCert();
    }
  }, [certificateNo]);

  const verifyCert = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await registrationService.verifyCertificate(certificateNo!);
      setCertificate(data);
    } catch (err: any) {
      setError('We couldn’t find that certificate. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    nikah: 'Nikah Certificate',
    death: 'Death Certificate',
    noc: 'No Objection Certificate (NOC)',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-block mb-4">
            <img src={LOGO_PATH} alt={BRAND_NAME} className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{BRAND_NAME}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Certificate Verification</p>
        </div>

        {error ? (
          <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
            <div className="flex flex-col items-center text-center py-8 px-6">
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <FiAlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Certificate Not Found
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                <FiArrowLeft className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </div>
          </Card>
        ) : certificate ? (
          <Card>
            <div className="flex flex-col items-center text-center py-8 px-6">
              {/* Status Badge */}
              <div
                className={`mb-4 p-3 rounded-full ${
                  certificate.status === 'valid'
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
                }`}
              >
                {certificate.status === 'valid' ? (
                  <FiCheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                ) : (
                  <FiAlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                )}
              </div>

              {/* Status Text */}
              <h2
                className={`text-lg font-semibold mb-2 ${
                  certificate.status === 'valid'
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}
              >
                {certificate.status === 'valid' ? 'Certificate Valid' : 'Certificate Revoked'}
              </h2>

              {/* Certificate Details */}
              <div className="mt-4 w-full space-y-4 text-left">
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Certificate Number
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {certificate.certificateNo}
                  </p>
                </div>

                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Certificate Type
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {typeLabels[certificate.type] || certificate.type}
                  </p>
                </div>

                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Issue Date
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {formatDate(certificate.issueDate)}
                  </p>
                </div>

                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Issued By Mahallu
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {certificate.issuedByMahallu ? toTitleCase(certificate.issuedByMahallu) : 'N/A'}
                  </p>
                </div>

                {certificate.status === 'revoked' && certificate.revokedReason && (
                  <div className="pb-4 bg-red-50 dark:bg-red-950 p-3 rounded">
                    <p className="text-label text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Revocation Reason
                    </p>
                    <p className="text-sm text-red-900 dark:text-red-100 mt-1">{certificate.revokedReason}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 w-full pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This certificate has been verified in the official registry
                </p>
                <Button onClick={() => navigate('/')} variant="outline" className="w-full mt-4">
                  <FiArrowLeft className="h-4 w-4 mr-2" />
                  Go to Home
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
