package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
)

// GenerateKeyPair generates a new RSA key pair and returns the private key
// and the public key in PEM format
func GenerateKeyPair() (*rsa.PrivateKey, string, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, "", err
	}

	// Extract public key
	publicKey := &privateKey.PublicKey

	// Encode public key to PEM format
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return nil, "", err
	}

	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	})

	return privateKey, string(publicKeyPEM), nil
}

// EncryptMessage encrypts a message using the recipient's public key
func EncryptMessage(message string, publicKeyPEM string) (string, error) {
	// Decode public key from PEM format
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return "", errors.New("failed to decode public key")
	}

	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return "", err
	}

	rsaPublicKey, ok := publicKey.(*rsa.PublicKey)
	if !ok {
		return "", errors.New("invalid public key type")
	}

	// Encrypt the message
	encryptedBytes, err := rsa.EncryptPKCS1v15(rand.Reader, rsaPublicKey, []byte(message))
	if err != nil {
		return "", err
	}

	// Encode the encrypted message to base64
	return base64.StdEncoding.EncodeToString(encryptedBytes), nil
}

// DecryptMessage decrypts a message using the private key
func DecryptMessage(encryptedMessage string, privateKey *rsa.PrivateKey) (string, error) {
	// Decode the encrypted message from base64
	encryptedBytes, err := base64.StdEncoding.DecodeString(encryptedMessage)
	if err != nil {
		return "", err
	}

	// Decrypt the message
	decryptedBytes, err := rsa.DecryptPKCS1v15(rand.Reader, privateKey, encryptedBytes)
	if err != nil {
		return "", err
	}

	return string(decryptedBytes), nil
}
