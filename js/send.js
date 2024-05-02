/*
 ***
 *** Enviar mensaje de contacto
 *** Serie: bWFpbC50bTpzeGFzZG9zam5Ad2lyZWNvbm5lY3RlZC5jb206OGQwNyFUUiw=
 ***
 */
const form = document.getElementById("form");
const result = document.getElementById("result");
const access = document.getElementById("access");

access.value = atob("ZDk0MzY0OTgtMGU5My00ZDMzLWE3ODktOGMzZTVmZDViNWQx");

form.addEventListener("submit", function (e) {
    const formData = new FormData(form);
    e.preventDefault();
    var object = {};
    formData.forEach((value, key) => {
        object[key] = value;
    });
    var json = JSON.stringify(object);
    result.innerHTML = "Paciencia...";

    fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: json
        })
        .then(async (response) => {
            let json = await response.json();
            if (response.status == 200) {
                if (json.success) {
                    result.innerHTML = "Correo enviado exitosamente!";
                } else {
                    result.innerHTML = json.message;
                }
                result.classList.remove("text-gray-500");
                result.classList.add("text-green-500");
            } else {
                console.log(response);
                result.innerHTML = json.message;
                result.classList.remove("text-gray-500");
                result.classList.add("text-red-500");
            }
        })
        .catch((error) => {
            console.log(error);
            result.innerHTML = "Algo falló en el camino F...";
        })
        .then(function () {
            form.reset();
            setTimeout(() => {
                result.style.display = "none";
            }, 5000);
        });
});