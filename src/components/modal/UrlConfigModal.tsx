import { useState, useEffect } from 'react';
import Modal from './Modal';
import { UrlInput } from './UrlInput';
import Constants from '../../utils/Constants';

interface UrlConfigModalProps {
    show: boolean;
    onClose: () => void;
    onSave: (url: string) => void;
}

export default function UrlConfigModal({ show, onClose, onSave }: UrlConfigModalProps) {
    const [url, setUrl] = useState(Constants.EXPORT_URL);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        // Reset the URL to the current value when the modal is opened
        if (show) {
            const currentUrl = localStorage.getItem('dwExportUrl') || Constants.EXPORT_URL;
            setUrl(currentUrl);
            validateUrl(currentUrl);
        }
    }, [show]);

    const validateUrl = (value: string) => {
        try {
            new URL(value);
            setIsValid(true);
            return true;
        } catch (e) {
            setIsValid(false);
            return false;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        validateUrl(newUrl);
    };

    const handleSave = () => {
        if (validateUrl(url)) {
            // Save to localStorage
            localStorage.setItem('dwExportUrl', url);
            onSave(url);
            onClose();
        }
    };

    return (
        <Modal
            show={show}
            onClose={onClose}
            onSubmit={handleSave}
            submitText="Spara"
            submitEnabled={isValid}
            title="Konfigurera DW Export URL"
            content={
                <div>
                    <p className="mb-4">
                        Ange URL för att skicka transkription till DW databasen:
                    </p>
                    <UrlInput
                        value={url}
                        onChange={handleChange}
                        placeholder="https://example.com/api/transcriptions"
                    />
                    {!isValid && (
                        <p className="text-red-500 text-xs mt-1">
                            Ogiltig URL. Vänligen ange en giltig URL.
                        </p>
                    )}
                </div>
            }
            cacheSize={0}
        />
    );
}