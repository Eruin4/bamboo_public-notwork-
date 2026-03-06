'use client';

import { useState, useRef } from 'react';

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
    error?: boolean;
}

export default function PasswordField({ label, description, className, error, ...props }: PasswordFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const checkCapsLock = (e: React.SyntheticEvent) => {
        let isCapsLockOn = false;

        if ('getModifierState' in e && typeof (e as any).getModifierState === 'function') {
            isCapsLockOn = (e as any).getModifierState('CapsLock');
        }
        else if (e.nativeEvent && typeof (e.nativeEvent as any).getModifierState === 'function') {
            isCapsLockOn = (e.nativeEvent as any).getModifierState('CapsLock');
        }

        setCapsLock(isCapsLockOn);

        if (inputRef.current) {
            if (isCapsLockOn) {
                // 커스텀 에러 메시지 설정
                inputRef.current.setCustomValidity('Caps Lock이 켜져있습니다');

                // 문구 확인 후 리포트 (중요: "이 입력란을 작성하세요" 등의 기본 메시지가 아닐 때만 띄움)
                if (document.activeElement === inputRef.current) {
                    // setCustomValidity가 즉시 반영되지 않을 수 있으므로 setTimeout 내부에서 확인
                    setTimeout(() => {
                        if (inputRef.current && inputRef.current.validationMessage === 'Caps Lock이 켜져있습니다') {
                            inputRef.current.reportValidity();
                        }
                    }, 0);
                }
            } else {
                inputRef.current.setCustomValidity('');
            }
        }
    };

    return (
        <div className={className}>
            {label && <label htmlFor={props.id} className="label">{label}</label>}
            <div className="relative focus-within:z-50">
                <input
                    {...props}
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    className={`input pr-12 w-full transition-colors duration-200 
                        ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/10' : ''} 
                        ${!error && capsLock ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-400/10 ring-1 ring-amber-400/10' : ''}`}

                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    onClick={checkCapsLock}
                    onFocus={(e) => {
                        setIsFocused(true);
                        checkCapsLock(e);
                        props.onFocus && props.onFocus(e);
                    }}
                    onChange={(e) => {
                        checkCapsLock(e);
                        props.onChange && props.onChange(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        setCapsLock(false);
                        if (inputRef.current) {
                            inputRef.current.setCustomValidity('');
                        }
                        props.onBlur && props.onBlur(e);
                    }}
                />

                {capsLock && (
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none animate-pulse">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L4.5 9.5H9V16H15V9.5H19.5L12 2ZM6 18V20H18V18H6Z" />
                        </svg>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1"
                    tabIndex={-1}
                >
                    {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>
            </div>
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
    );
}
