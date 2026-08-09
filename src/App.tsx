import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLngTuple } from 'leaflet';
import { Header } from './components/Header';
import { IncidentForm } from './components/IncidentForm';
import { AnalysisCard } from './components/AnalysisCard';
import { HomeDashboard } from './components/HomeDashboard';
import { SafetyMap } from './components/SafetyMap';
import { WalkWithMe } from './components/WalkWithMe';
import { Profile } from './components/Profile';
import { MobileNavigation } from './components/MobileNavigation';
import { LocationConfirmationSheet } from './components/LocationConfirmationSheet';
import { QuickSafetyCheckSheet } from './components/QuickSafetyCheckSheet';
import { EmergencyToolkit } from './components/EmergencyToolkit';
import type { NavTab } from './components/MobileNavigation';
import type { IncidentFormData, AnalysisResult } from './types/incident';
import type { PendingCommunitySignal } from './types/pendingReport';
import type { UserProfile } from './types/userProfile';
import { analyseIncidentReport } from './services/api';
import { useWalkSession } from './hooks/useWalkSession';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useAppearance } from './hooks/useAppearance';
import { useEmergencyToolkit } from './hooks/useEmergencyToolkit';
import { countNearbySafetySignals, summarizeNearbySafetySignals } from './utils/safetySignalCounts';
import {
  createPendingReportId,
  clearPendingReports,
  loadPendingReports,
  savePendingReport,
} from './services/pendingReportsStorage';
import {
  clearUserProfile,
  loadUserProfile,
  saveUserProfile,
} from './services/userProfileStorage';
import { AlertTriangle, CheckCircle2, MapPinned, XCircle } from 'lucide-react';
import type { AppearancePreference } from './types/appearance';
import { maskPhoneNumber, normalizeDialablePhoneNumber } from './utils/phoneNumber';

interface AppProps {
  initialAppearancePreference: AppearancePreference;
}

export const App: React.FC<AppProps> = ({ initialAppearancePreference }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [submittedReport, setSubmittedReport] = useState<IncidentFormData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingCommunitySignal[]>(() => loadPendingReports());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => loadUserProfile());
  const [isQuickSafetyCheckOpen, setIsQuickSafetyCheckOpen] = useState(false);
  const [isLocationConfirmationOpen, setIsLocationConfirmationOpen] = useState(false);
  const [isSavingPendingReport, setIsSavingPendingReport] = useState(false);
  const [pendingSaveError, setPendingSaveError] = useState<string | null>(null);
  const [savedPendingReport, setSavedPendingReport] = useState<PendingCommunitySignal | null>(null);
  const [focusedPendingReportId, setFocusedPendingReportId] = useState<string | null>(null);
  const [prototypeResetNoticeId, setPrototypeResetNoticeId] = useState(0);
  const savingPendingReportRef = useRef(false);
  const pendingDraftIdRef = useRef<string | null>(null);
  const analysisRequestIdRef = useRef(0);
  const analysisRequestInFlightRef = useRef(false);
  const walkController = useWalkSession();
  const currentLocation = useCurrentLocation();
  const appearanceController = useAppearance(initialAppearancePreference);
  const emergencyController = useEmergencyToolkit();

  useEffect(() => {
    if (prototypeResetNoticeId === 0) return;
    const timeoutId = window.setTimeout(() => setPrototypeResetNoticeId(0), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [prototypeResetNoticeId]);

  const handleFormSubmit = async (data: IncidentFormData) => {
    if (analysisRequestInFlightRef.current) return;
    analysisRequestInFlightRef.current = true;
    const requestId = analysisRequestIdRef.current + 1;
    analysisRequestIdRef.current = requestId;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSubmittedReport(data);
    setSavedPendingReport(null);
    setPendingSaveError(null);
    pendingDraftIdRef.current = null;

    try {
      const result = await analyseIncidentReport(data);
      if (analysisRequestIdRef.current === requestId) setAnalysisResult(result);
    } catch (err: any) {
      if (analysisRequestIdRef.current === requestId) {
        setErrorMessage(
          err?.message || 'Unable to complete analysis. Please check your network or server configuration.'
        );
      }
    } finally {
      if (analysisRequestIdRef.current === requestId) {
        analysisRequestInFlightRef.current = false;
        setIsAnalyzing(false);
      }
    }
  };

  const handleRetryAnalysis = () => {
    if (!submittedReport || analysisRequestInFlightRef.current) return;
    void handleFormSubmit(submittedReport);
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setSubmittedReport(null);
    setErrorMessage(null);
    setSavedPendingReport(null);
    setPendingSaveError(null);
    setIsLocationConfirmationOpen(false);
    pendingDraftIdRef.current = null;
  };

  const handleTabChange = (tab: NavTab) => {
    setIsQuickSafetyCheckOpen(false);
    emergencyController.closeToolkit();
    setActiveTab(tab);
  };

  const handleOpenEmergencyToolkit = () => {
    setIsQuickSafetyCheckOpen(false);
    emergencyController.openToolkit();
  };

  const handleOpenLocationConfirmation = () => {
    if (!analysisResult || analysisResult.isSafetyRelevant !== true || !submittedReport || savedPendingReport) return;
    pendingDraftIdRef.current ??= createPendingReportId();
    setPendingSaveError(null);
    setIsLocationConfirmationOpen(true);
  };

  const handleSavePendingReport = async (position: LatLngTuple) => {
    if (
      savingPendingReportRef.current ||
      !analysisResult ||
      analysisResult.isSafetyRelevant !== true ||
      !submittedReport ||
      savedPendingReport
    ) return;

    savingPendingReportRef.current = true;
    setIsSavingPendingReport(true);
    setPendingSaveError(null);

    try {
      const extractedAreaName = analysisResult.location?.trim();
      const areaName = extractedAreaName && extractedAreaName.toLowerCase() !== 'unknown'
        ? extractedAreaName
        : 'User-selected location';

      const report: PendingCommunitySignal = {
        id: pendingDraftIdRef.current ?? createPendingReportId(),
        latitude: position[0],
        longitude: position[1],
        areaName,
        category: analysisResult.category,
        severity: analysisResult.severity,
        timeContext: analysisResult.timeContext?.trim() || 'Unknown',
        summary: analysisResult.summary,
        sourceType: 'Community',
        verificationStatus: 'Pending',
        reportCount: 1,
        createdAt: new Date().toISOString(),
        originalLocationText: submittedReport.location,
        isDemoData: false,
      };

      const nextReports = savePendingReport(report);
      setPendingReports(nextReports);
      setSavedPendingReport(report);
      setFocusedPendingReportId(report.id);
      setIsLocationConfirmationOpen(false);
    } catch (error) {
      setPendingSaveError(
        error instanceof Error ? error.message : 'The report could not be saved. Please try again.'
      );
    } finally {
      savingPendingReportRef.current = false;
      setIsSavingPendingReport(false);
    }
  };

  const handleViewSavedReport = () => {
    if (!savedPendingReport) return;
    setFocusedPendingReportId(savedPendingReport.id);
    handleTabChange('map');
  };

  const handleOpenSafetyMap = () => {
    setIsQuickSafetyCheckOpen(false);
    emergencyController.closeToolkit();
    setFocusedPendingReportId(null);
    setActiveTab('map');
  };

  const handleViewPendingReport = (reportId: string) => {
    setFocusedPendingReportId(reportId);
    handleTabChange('map');
  };

  const handleSaveUserProfile = (profile: UserProfile) => {
    const savedProfile = saveUserProfile(profile);
    setUserProfile(savedProfile);
    return savedProfile;
  };

  const handleResetDemoData = () => {
    // Invalidate in-flight analysis first so it cannot repopulate cleared UI state.
    analysisRequestIdRef.current += 1;
    analysisRequestInFlightRef.current = false;
    savingPendingReportRef.current = false;
    pendingDraftIdRef.current = null;

    clearPendingReports();
    clearUserProfile();
    walkController.resetSession();
    emergencyController.stopEmergencyMode();

    setPendingReports([]);
    setUserProfile(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setSubmittedReport(null);
    setErrorMessage(null);
    setIsQuickSafetyCheckOpen(false);
    setIsLocationConfirmationOpen(false);
    setIsSavingPendingReport(false);
    setPendingSaveError(null);
    setSavedPendingReport(null);
    setFocusedPendingReportId(null);

    // Navigate only after every App-owned modal, sheet, focus, and banner state is cleared.
    setActiveTab('home');
    setPrototypeResetNoticeId((current) => current + 1);
  };

  const isMapTab = activeTab === 'map';
  const walkCoordinates = walkController.session?.latestCoordinates ?? walkController.session?.startingCoordinates;
  const walkLatitude = walkCoordinates?.latitude;
  const walkLongitude = walkCoordinates?.longitude;
  const walkPosition = useMemo<LatLngTuple | null>(
    () => walkLatitude !== undefined && walkLongitude !== undefined ? [walkLatitude, walkLongitude] : null,
    [walkLatitude, walkLongitude]
  );
  const emergencyLatitude = emergencyController.location.latestPosition?.latitude;
  const emergencyLongitude = emergencyController.location.latestPosition?.longitude;
  const emergencyPosition = useMemo<LatLngTuple | null>(
    () => emergencyController.location.isTracking
      && emergencyLatitude !== undefined
      && emergencyLongitude !== undefined
      ? [emergencyLatitude, emergencyLongitude]
      : null,
    [emergencyController.location.isTracking, emergencyLatitude, emergencyLongitude]
  );
  const overviewPosition = walkController.isActiveOnMap && walkPosition
    ? walkPosition
    : currentLocation.position;
  const overviewLocationStatus = overviewPosition ? 'available' : currentLocation.status;
  const homeNearbyCounts = useMemo(
    () => overviewPosition ? countNearbySafetySignals(overviewPosition, pendingReports) : null,
    [overviewPosition, pendingReports]
  );
  const quickSafetySummary = useMemo(
    () => currentLocation.position
      ? summarizeNearbySafetySignals(currentLocation.position, pendingReports)
      : null,
    [currentLocation.position, pendingReports]
  );

  return (
    <div className="mobile-view-wrapper">
      <div className="mobile-container">
        {/* Header shown on all screens except full-screen map */}
        {!isMapTab && <Header />}

        {/* Main content area */}
        <main className={`app-body ${isMapTab ? 'app-body--map' : ''}`}>

          {/* ── Home dashboard ── */}
          {activeTab === 'home' && (
            <>
              {prototypeResetNoticeId > 0 && (
                <div className="prototype-reset-success animate-fade-in" role="status" aria-live="polite">
                  <CheckCircle2 size={17} />
                  <span>Demo data reset successfully.</span>
                </div>
              )}
              <HomeDashboard
                displayName={userProfile?.displayName ?? ''}
                locationStatus={overviewLocationStatus}
                nearbyCounts={homeNearbyCounts}
                pendingReports={pendingReports}
                walkController={walkController}
                emergencyLocationActive={emergencyController.location.isTracking}
                onOpenEmergencyToolkit={handleOpenEmergencyToolkit}
                onOpenQuickSafetyCheck={() => setIsQuickSafetyCheckOpen(true)}
                onViewSafetyMap={handleOpenSafetyMap}
                onReportIncident={() => handleTabChange('report')}
                onOpenWalkWithMe={() => handleTabChange('walk')}
                onViewPendingReport={handleViewPendingReport}
              />
            </>
          )}

          {/* ── Safety Map ── */}
          {activeTab === 'map' && (
            <SafetyMap
              pendingReports={pendingReports}
              focusedPendingReportId={focusedPendingReportId}
              walkWithMeActive={walkController.isActiveOnMap}
              journeyPosition={walkController.isActiveOnMap ? walkPosition : null}
              emergencyLocationActive={emergencyController.location.isTracking}
              emergencyPosition={emergencyPosition}
              currentPosition={currentLocation.position}
              locationStatus={currentLocation.status}
              onFocusedPendingReportClose={() => setFocusedPendingReportId(null)}
              onNavigateToReport={() => handleTabChange('report')}
              onOpenEmergencyToolkit={handleOpenEmergencyToolkit}
            />
          )}

          {/* ── Report Incident (existing Gemini flow) ── */}
          {activeTab === 'report' && (
            <>
              {errorMessage && (
                <div className="error-banner animate-fade-in">
                  <div className="error-banner-header">
                    <AlertTriangle size={18} className="error-banner-icon" />
                    <span>Analysis Error</span>
                    <button
                      type="button"
                      className="error-dismiss-btn"
                      onClick={() => setErrorMessage(null)}
                      title="Dismiss error"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                  <p className="error-banner-text">{errorMessage}</p>
                  {submittedReport && (
                    <button
                      type="button"
                      className="error-retry-button"
                      onClick={handleRetryAnalysis}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? 'Retrying analysis…' : 'Retry Analysis'}
                    </button>
                  )}
                </div>
              )}

              {!analysisResult ? (
                <IncidentForm onSubmit={handleFormSubmit} isAnalyzing={isAnalyzing} />
              ) : (
                <>
                  <AnalysisCard
                    analysis={analysisResult}
                    onReset={handleReset}
                    onAddToMap={handleOpenLocationConfirmation}
                    isAddedToMap={savedPendingReport !== null}
                  />

                  {savedPendingReport && (
                    <div className="map-save-success animate-fade-in" role="status">
                      <div className="map-save-success-icon"><CheckCircle2 size={22} /></div>
                      <div className="map-save-success-copy">
                        <strong>Report added as a pending community signal.</strong>
                        <span>It is user-submitted and has not been verified.</span>
                      </div>
                      <button type="button" className="btn btn-primary btn-full" onClick={handleViewSavedReport}>
                        <MapPinned size={17} />
                        View on Safety Map
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Walk With Me ── */}
          {activeTab === 'walk' && (
            <WalkWithMe
              controller={walkController}
              defaultTrustedContact={{
                name: userProfile?.trustedContactName ?? '',
                phone: userProfile?.trustedContactPhone ?? '',
              }}
              onViewSafetyMap={handleOpenSafetyMap}
              onOpenEmergencyToolkit={handleOpenEmergencyToolkit}
            />
          )}

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <Profile
              profile={userProfile}
              locationStatus={currentLocation.status}
              pendingReportCount={pendingReports.length}
              appearancePreference={appearanceController.preference}
              activeAppearance={appearanceController.resolvedAppearance}
              appearanceSaveError={appearanceController.saveError}
              onAppearanceChange={appearanceController.selectAppearance}
              onSaveProfile={handleSaveUserProfile}
              onResetDemoData={handleResetDemoData}
            />
          )}
        </main>

        {isQuickSafetyCheckOpen && (
          <QuickSafetyCheckSheet
            locationStatus={currentLocation.status}
            summary={quickSafetySummary}
            onClose={() => setIsQuickSafetyCheckOpen(false)}
            onViewSafetyMap={handleOpenSafetyMap}
          />
        )}

        {emergencyController.isOpen && (
          <EmergencyToolkit
            controller={emergencyController}
            trustedContactName={userProfile?.trustedContactName ?? ''}
            maskedTrustedContactNumber={maskPhoneNumber(userProfile?.trustedContactPhone)}
            hasTrustedContactPhone={Boolean(normalizeDialablePhoneNumber(userProfile?.trustedContactPhone ?? ''))}
            onConfirmTrustedContactCall={() => {
              const phone = userProfile?.trustedContactPhone;
              if (!phone) {
                emergencyController.cancelConfirmation();
                return;
              }
              emergencyController.confirmTrustedContactCall(phone);
            }}
            onViewSafetyMap={handleOpenSafetyMap}
          />
        )}

        {isLocationConfirmationOpen && (
          <LocationConfirmationSheet
            initialPosition={walkPosition ?? currentLocation.position}
            isSaving={isSavingPendingReport}
            saveError={pendingSaveError}
            onPositionKnown={currentLocation.rememberPosition}
            onConfirm={handleSavePendingReport}
            onCancel={() => {
              if (savingPendingReportRef.current) return;
              setPendingSaveError(null);
              setIsLocationConfirmationOpen(false);
            }}
          />
        )}

        {/* Fixed bottom navigation */}
        <MobileNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
};

export default App;
