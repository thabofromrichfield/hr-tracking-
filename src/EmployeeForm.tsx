import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ImageUp,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  SwitchCamera,
  X,
} from 'lucide-react';
import {
  Branch,
  CustomField,
  Employee,
  EmployeeDocument,
  EmploymentType,
  Status,
} from './types';
import { Avatar, Modal } from './components';
import {
  type BlockScanStatus,
  type EmployeeBlockKey,
  type EmployeeFormDraft,
  type EmployeeOcrExtraction,
  PRIORITY_OCR_FIELDS,
  runEmployeeImageOcr,
} from './lib/employee-ocr.ts';

const blank: EmployeeFormDraft = {
  fullName: '',
  idNumber: '',
  employeeNumber: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  jobTitle: '',
  department: '',
  manager: '',
  employmentType: 'Full-time',
  startDate: new Date().toISOString().slice(0, 10),
  status: 'Active',
  bio: '',
  skills: '',
  languages: '',
  custom: {},
  branchId: '',
  monthlySalary: 0,
};

export default function EmployeeForm({
  employee,
  customFields,
  branches,
  onClose,
  onSave,
}: {
  employee?: Employee;
  customFields: CustomField[];
  branches: Branch[];
  onClose: () => void;
  onSave: (data: EmployeeFormDraft, initialDocument?: EmployeeDocument) => void;
}) {
  const [form, setForm] = useState<EmployeeFormDraft>(
    employee ? { ...employee, custom: { ...employee.custom } } : blank
  );

  // OCR & Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState('');
  const [scanExtraction, setScanExtraction] = useState<EmployeeOcrExtraction | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [scanSizeLabel, setScanSizeLabel] = useState('');
  const [attachScanDoc, setAttachScanDoc] = useState(true);
  const [showRawText, setShowRawText] = useState(false);
  const [expandedSkippedBlocks, setExpandedSkippedBlocks] = useState<
    Record<EmployeeBlockKey, boolean>
  >({
    personal: false,
    employment: false,
    about: false,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const ocrUploadRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  async function openLiveCamera(preferredFacing: 'environment' | 'user' = facingMode) {
    setCameraError('');
    setScanError('');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      nativeCameraRef.current?.click();
      return;
    }

    stopCameraStream();
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      stopCameraStream();
      setCameraOpen(false);
      setCameraError(
        'Live camera access was blocked by the browser. Opening your device camera / photo picker instead.'
      );
      nativeCameraRef.current?.click();
    }
  }

  async function flipCamera() {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (cameraOpen) {
      await openLiveCamera(nextFacing);
    }
  }

  async function captureFromVideo() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setScanError('Camera frame is still initialising. Wait a moment and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCameraStream();
    setCameraOpen(false);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92)
    );
    if (blob) {
      await processOcrSource(blob);
    }
  }

  async function processOcrSource(source: File | Blob) {
    if (source.size > 15 * 1024 * 1024) {
      setScanError('Please choose or capture an image under 15 MB.');
      return;
    }

    setScanning(true);
    setScanError('');
    setCameraError('');
    setScanProgress(5);
    setScanStatus('Preparing image for OCR…');

    try {
      const { extraction, previewDataUrl, sizeLabel } = await runEmployeeImageOcr(
        source,
        {
          branches,
          customFields,
        },
        update => {
          setScanStatus(update.status);
          setScanProgress(update.progress);
        }
      );

      setScanExtraction(extraction);
      setScanPreviewUrl(previewDataUrl);
      setScanSizeLabel(sizeLabel);
      setExpandedSkippedBlocks({
        personal: false,
        employment: false,
        about: false,
      });

      setForm(prev => {
        const nextCustom = {
          ...prev.custom,
          ...(extraction.values.custom ?? {}),
        };

        const baseForMissing = employee
          ? prev
          : {
              ...prev,
              startDate: extraction.values.startDate ?? '',
              monthlySalary: extraction.values.monthlySalary ?? 0,
            };

        return {
          ...baseForMissing,
          ...extraction.values,
          custom: nextCustom,
        };
      });
    } catch (err) {
      setScanError(
        err instanceof Error
          ? `OCR scan could not read that image: ${err.message}`
          : 'OCR scan failed. Try a clearer, well-lit photo.'
      );
    } finally {
      setScanning(false);
    }
  }

  function clearScan() {
    setScanExtraction(null);
    setScanPreviewUrl('');
    setScanSizeLabel('');
    setScanError('');
    setShowRawText(false);
    setExpandedSkippedBlocks({
      personal: false,
      employment: false,
      about: false,
    });
    if (!employee) {
      setForm(blank);
    }
  }

  const set = (key: keyof EmployeeFormDraft, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const photo = (file?: File) => {
    if (!file) return;
    if (file.size > 1500000) {
      alert('Please choose a profile photo smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('photo', String(reader.result));
    reader.readAsDataURL(file);
  };

  const hasScanned = scanExtraction !== null;
  const filledSet = new Set(scanExtraction?.filledFields ?? []);
  const missingSet = new Set(scanExtraction?.missingFields ?? []);

  const fieldState = (
    key: string,
    currentValue: string | number | undefined
  ): 'none' | 'filled' | 'optional-missing' => {
    if (!hasScanned) return 'none';
    if (filledSet.has(key)) return 'filled';
    const hasManualValue =
      typeof currentValue === 'number'
        ? currentValue > 0
        : Boolean(currentValue && String(currentValue).trim());
    if (hasManualValue) return 'none';
    if (missingSet.has(key)) return 'optional-missing';
    return 'none';
  };

  const isFieldRequired = (defaultRequired: boolean): boolean =>
    hasScanned ? false : defaultRequired;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setScanError('');

    const fallbackName =
      form.fullName.trim() ||
      (form.idNumber
        ? `Employee ${form.idNumber.slice(0, 6)}`
        : form.email
        ? form.email.split('@')[0]
        : '');

    if (!fallbackName) {
      setScanError(
        'Enter at least the employee’s name (or scan a clearer photo showing their name, ID, or email).'
      );
      return;
    }

    const cleanedForm: EmployeeFormDraft = {
      ...form,
      fullName: fallbackName,
    };

    const scanDoc: EmployeeDocument | undefined =
      hasScanned && attachScanDoc && scanPreviewUrl
        ? {
            id: crypto.randomUUID(),
            name: `OCR-Scan-${fallbackName.replace(/\s+/g, '-')}.jpg`,
            type: 'OCR Scanned Image',
            date: new Date().toISOString().slice(0, 10),
            size: scanSizeLabel || '120 KB',
            data: scanPreviewUrl,
          }
        : undefined;

    onSave(cleanedForm, scanDoc);
  };

  const renderBlockSection = (
    blockKey: EmployeeBlockKey,
    number: string,
    title: string,
    children: React.ReactNode
  ) => {
    const blockInfo: BlockScanStatus | undefined = scanExtraction?.blocks[blockKey];
    const isAutoSkipped =
      hasScanned && Boolean(blockInfo?.allMissing) && !expandedSkippedBlocks[blockKey];

    return (
      <section
        className={`form-section ${
          blockInfo?.allMissing && hasScanned ? 'form-section--skipped' : ''
        }`}
      >
        <div className="form-section-head">
          <h3>
            <span>{number}</span>
            {title}
          </h3>
          {hasScanned && blockInfo && (
            <div className="form-section-badges">
              {blockInfo.allMissing ? (
                <>
                  <span className="ocr-badge ocr-badge--optional">
                    <CircleDashed size={12} />
                    Missing on image · Skipped (Optional)
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small ocr-expand-btn"
                    onClick={() =>
                      setExpandedSkippedBlocks(prev => ({
                        ...prev,
                        [blockKey]: !prev[blockKey],
                      }))
                    }
                  >
                    {isAutoSkipped ? (
                      <>
                        <ChevronDown size={13} />
                        Fill optional block
                      </>
                    ) : (
                      <>
                        <ChevronUp size={13} />
                        Skip block
                      </>
                    )}
                  </button>
                </>
              ) : (
                <span className="ocr-badge ocr-badge--partial">
                  <Sparkles size={12} />
                  {blockInfo.filledCount} filled ·{' '}
                  {blockInfo.totalCount - blockInfo.filledCount} optional
                </span>
              )}
            </div>
          )}
        </div>

        {isAutoSkipped ? (
          <p className="ocr-skipped-note">
            No {title.toLowerCase()} were found in the scanned picture. This block
            is marked <strong>Optional</strong> and will be skipped automatically,
            or click <strong>Fill optional block</strong> to add details manually.
          </p>
        ) : (
          <div className="form-grid">{children}</div>
        )}
      </section>
    );
  };

  return (
    <Modal
      title={employee ? 'Edit employee' : 'Register a new employee'}
      subtitle={
        employee
          ? `Update ${employee.fullName}'s information`
          : 'Scan an ID, CV, contract, or HR sheet to auto-fill key details — missing blocks are skipped as optional'
      }
      onClose={() => {
        stopCameraStream();
        onClose();
      }}
      wide
    >
      <form onSubmit={submit} noValidate={hasScanned}>
        <div className="modal-body employee-form">
          <div className="ocr-panel">
            <div className="ocr-panel-top">
              <div className="ocr-panel-title">
                <div className="ocr-icon-wrap" aria-hidden="true">
                  <ScanLine size={20} />
                </div>
                <div>
                  <strong>Auto-fill from picture (OCR)</strong>
                  <p>
                    Hunts down <strong>ID number</strong>,{' '}
                    <strong>Contact number</strong>, <strong>Date of birth</strong>,{' '}
                    <strong>Full name</strong>, <strong>Email address</strong>,{' '}
                    <strong>Home address</strong>, <strong>Job title</strong>, and{' '}
                    <strong>Start date</strong> first. Missing blocks are marked
                    optional and skipped.
                  </p>
                </div>
              </div>

              <div className="ocr-panel-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={scanning}
                  onClick={() => void openLiveCamera()}
                >
                  <Camera size={15} />
                  Take picture
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  disabled={scanning}
                  onClick={() => ocrUploadRef.current?.click()}
                >
                  <ImageUp size={15} />
                  Upload photo
                </button>
                {hasScanned && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={scanning}
                    onClick={clearScan}
                    title="Reset scanned flags"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <input
              ref={ocrUploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void processOcrSource(file);
              }}
            />
            <input
              ref={nativeCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void processOcrSource(file);
              }}
            />

            {cameraOpen && (
              <div className="ocr-camera-box">
                <div className="ocr-video-frame">
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className="ocr-frame-guide" aria-hidden="true" />
                </div>
                <div className="ocr-camera-controls">
                  <span className="ocr-camera-hint">
                    Hold steady so all text on the page or card is sharp
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => void flipCamera()}
                    >
                      <SwitchCamera size={15} />
                      Flip camera
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => void captureFromVideo()}
                    >
                      <Camera size={15} />
                      Capture &amp; scan
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        stopCameraStream();
                        setCameraOpen(false);
                      }}
                    >
                      <X size={15} />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanning && (
              <div className="ocr-progress-box" role="status" aria-live="polite">
                <div className="ocr-progress-head">
                  <span>
                    <RefreshCw size={14} className="ocr-spin" />
                    {scanStatus}
                  </span>
                  <strong>{scanProgress}%</strong>
                </div>
                <div className="ocr-progress-track">
                  <div
                    className="ocr-progress-fill"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            {cameraError && (
              <div
                className="auth-notice auth-notice--info"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                {cameraError}
              </div>
            )}

            {scanError && (
              <div
                role="alert"
                className="auth-notice auth-notice--error"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                {scanError}
              </div>
            )}

            {hasScanned && scanExtraction && !scanning && (
              <div className="ocr-result-bar" role="status" aria-live="polite">
                {scanPreviewUrl && (
                  <img
                    src={scanPreviewUrl}
                    alt="Scanned document preview"
                    className="ocr-thumb"
                  />
                )}
                <div className="ocr-result-copy">
                  <strong>
                    {scanExtraction.priorityFound.length} of{' '}
                    {PRIORITY_OCR_FIELDS.length} priority fields captured (
                    {scanExtraction.filledFields.length} total fields filled)
                  </strong>
                  <div className="ocr-priority-chips">
                    {PRIORITY_OCR_FIELDS.map(item => {
                      const found = filledSet.has(item.key);
                      return (
                        <span
                          key={item.key}
                          className={`ocr-pill ${
                            found ? 'ocr-pill--filled' : 'ocr-pill--optional'
                          }`}
                        >
                          {found && <CheckCircle2 size={10} />}
                          {item.label}: {found ? 'Filled' : 'Optional'}
                        </span>
                      );
                    })}
                  </div>
                  <div className="ocr-result-options">
                    {!employee && scanPreviewUrl && (
                      <label className="ocr-AttachCheck">
                        <input
                          type="checkbox"
                          checked={attachScanDoc}
                          onChange={e => setAttachScanDoc(e.target.checked)}
                        />
                        Save scanned image in employee documents
                      </label>
                    )}
                    {scanExtraction.rawText && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setShowRawText(v => !v)}
                      >
                        {showRawText ? 'Hide read text' : 'View read text'}
                      </button>
                    )}
                  </div>
                  {showRawText && (
                    <pre className="ocr-raw-preview">{scanExtraction.rawText}</pre>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="photo-form">
            <Avatar
              employee={{ ...form, id: employee?.id || 'e0' } as Employee}
              size="lg"
            />
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={15} />
                {form.photo ? 'Change profile photo' : 'Add profile photo'}
              </button>
              <span>Optional · Portrait JPG or PNG</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => photo(e.target.files?.[0])}
            />
          </div>

          {renderBlockSection(
            'personal',
            '01',
            'Personal information',
            <>
              <Field
                label="Full name"
                required={isFieldRequired(true)}
                ocrState={fieldState('fullName', form.fullName)}
              >
                <input
                  required={isFieldRequired(true)}
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  placeholder="e.g. Thandi Moyo"
                />
              </Field>
              <Field
                label="ID number"
                required={isFieldRequired(true)}
                ocrState={fieldState('idNumber', form.idNumber)}
              >
                <input
                  required={isFieldRequired(true)}
                  value={form.idNumber}
                  onChange={e => set('idNumber', e.target.value)}
                  placeholder="South African ID number"
                />
              </Field>
              <Field
                label="Date of birth"
                required={isFieldRequired(true)}
                ocrState={fieldState('dob', form.dob)}
              >
                <input
                  required={isFieldRequired(true)}
                  type="date"
                  value={form.dob}
                  onChange={e => set('dob', e.target.value)}
                />
              </Field>
              <Field
                label="Contact number"
                required={isFieldRequired(true)}
                ocrState={fieldState('phone', form.phone)}
              >
                <input
                  required={isFieldRequired(true)}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+27"
                />
              </Field>
              <Field
                label="Email address"
                required={isFieldRequired(true)}
                ocrState={fieldState('email', form.email)}
              >
                <input
                  required={isFieldRequired(true)}
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="name@company.co.za"
                />
              </Field>
              <Field
                label="Employee number"
                required={isFieldRequired(true)}
                ocrState={fieldState('employeeNumber', form.employeeNumber)}
              >
                <input
                  required={isFieldRequired(true)}
                  value={form.employeeNumber}
                  onChange={e => set('employeeNumber', e.target.value)}
                  placeholder={hasScanned ? 'Optional (not on image)' : 'PF-0000'}
                />
              </Field>
              <Field
                label="Home address"
                full
                ocrState={fieldState('address', form.address)}
              >
                <input
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Street, suburb, city, postal code"
                />
              </Field>
              <Field
                label="Emergency contact"
                ocrState={fieldState('emergencyName', form.emergencyName)}
              >
                <input
                  value={form.emergencyName}
                  onChange={e => set('emergencyName', e.target.value)}
                  placeholder="Contact name"
                />
              </Field>
              <Field
                label="Emergency number"
                ocrState={fieldState('emergencyPhone', form.emergencyPhone)}
              >
                <input
                  value={form.emergencyPhone}
                  onChange={e => set('emergencyPhone', e.target.value)}
                  placeholder="+27"
                />
              </Field>
            </>
          )}

          {renderBlockSection(
            'employment',
            '02',
            'Employment details',
            <>
              <Field
                label="Job title"
                required={isFieldRequired(true)}
                ocrState={fieldState('jobTitle', form.jobTitle)}
              >
                <input
                  required={isFieldRequired(true)}
                  value={form.jobTitle}
                  onChange={e => set('jobTitle', e.target.value)}
                  placeholder={
                    hasScanned ? 'Optional (not on image)' : 'e.g. Product Designer'
                  }
                />
              </Field>
              <Field
                label="Start date"
                required={isFieldRequired(true)}
                ocrState={fieldState('startDate', form.startDate)}
              >
                <input
                  required={isFieldRequired(true)}
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                />
              </Field>
              <Field
                label="Reports to"
                ocrState={fieldState('manager', form.manager)}
              >
                <input
                  value={form.manager}
                  onChange={e => set('manager', e.target.value)}
                  placeholder="Manager's full name"
                />
              </Field>
              <Field
                label="Employment type"
                ocrState={fieldState(
                  'employmentType',
                  filledSet.has('employmentType') ? form.employmentType : ''
                )}
              >
                <select
                  value={form.employmentType}
                  onChange={e =>
                    set('employmentType', e.target.value as EmploymentType)
                  }
                >
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </Field>
              <Field
                label="Branch"
                ocrState={fieldState('branchId', form.branchId)}
              >
                <select
                  value={form.branchId || ''}
                  onChange={e => set('branchId', e.target.value)}
                >
                  <option value="">No branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Monthly salary (R)"
                ocrState={fieldState('monthlySalary', form.monthlySalary)}
              >
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.monthlySalary ? form.monthlySalary : ''}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      monthlySalary: Number(e.target.value),
                    }))
                  }
                  placeholder="Used to generate payslips"
                />
              </Field>
              <Field
                label="Status"
                ocrState={fieldState(
                  'status',
                  filledSet.has('status') ? form.status : ''
                )}
              >
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as Status)}
                >
                  <option>Active</option>
                  <option>On leave</option>
                  <option>Resigned</option>
                  <option>Terminated</option>
                </select>
              </Field>
              {(form.status === 'Resigned' || form.status === 'Terminated') && (
                <Field label="End date" required={isFieldRequired(true)}>
                  <input
                    required={isFieldRequired(true)}
                    type="date"
                    value={form.endDate || ''}
                    onChange={e => set('endDate', e.target.value)}
                  />
                </Field>
              )}
            </>
          )}

          {renderBlockSection(
            'about',
            '03',
            'A little more about them',
            <>
              <Field
                label="Short bio"
                full
                ocrState={fieldState('bio', form.bio)}
              >
                <textarea
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="A few words about who they are, their interests, or what they care about..."
                  rows={3}
                />
              </Field>
              <Field
                label="Skills"
                ocrState={fieldState('skills', form.skills)}
              >
                <input
                  value={form.skills}
                  onChange={e => set('skills', e.target.value)}
                  placeholder="Separated by commas"
                />
              </Field>
              <Field
                label="Languages"
                ocrState={fieldState('languages', form.languages)}
              >
                <input
                  value={form.languages}
                  onChange={e => set('languages', e.target.value)}
                  placeholder="Separated by commas"
                />
              </Field>
              {customFields.map(field => (
                <Field
                  key={field.id}
                  label={field.label}
                  ocrState={fieldState(
                    `custom:${field.label}`,
                    form.custom[field.label]
                  )}
                >
                  <input
                    type={
                      field.type === 'Text' ? 'text' : field.type.toLowerCase()
                    }
                    value={form.custom[field.label] || ''}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        custom: { ...f.custom, [field.label]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={scanning}>
            <Save size={17} />
            {employee ? 'Save changes' : 'Register employee'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  required,
  full,
  ocrState = 'none',
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  ocrState?: 'none' | 'filled' | 'optional-missing';
  children: React.ReactNode;
}) {
  return (
    <label
      className={`field ${full ? 'field-full' : ''} ${
        ocrState === 'filled'
          ? 'field--ocr-filled'
          : ocrState === 'optional-missing'
          ? 'field--ocr-optional'
          : ''
      }`}
    >
      <span className="field-label-row">
        <span>
          {label}
          {required && <em>*</em>}
        </span>
        {ocrState === 'filled' && (
          <b className="ocr-pill ocr-pill--filled">
            <CheckCircle2 size={11} />
            Filled
          </b>
        )}
        {ocrState === 'optional-missing' && (
          <b className="ocr-pill ocr-pill--optional">Optional · missing</b>
        )}
      </span>
      {children}
    </label>
  );
}
