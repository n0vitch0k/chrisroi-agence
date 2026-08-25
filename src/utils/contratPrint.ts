// Générateur HTML/PDF — CONTRAT DE PRESTATION DE SERVICE DE PLACEMENT
// Remplace définitivement l'ancien "Contrat de travail".
// Verbatim 10 articles du docx "Papier entête CHRISROI ..." (5 pages WPS, 1268 mots).
// Calé sur 3 pages A4 à l'impression : @page 10mm, 10pt, header/footer compacts.
// Header/Footer répétés visuellement sur chaque page (fixed via @page equiv.).
// Cross-platform : window.print (web) + expo-print printToFileAsync (natif).

import type { ContratsRecord as Contrat } from '../types/pb-generated';

// Header image du docx (word/media/image1.jpeg, 7475 bytes) + fallback logo texte
const HEADER_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEA3ADcAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAEyATUDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/wA0UUUAGaKKKACjNFFABRmiigAooooAM0UUUAGaOtFFABRmiigAozRRQAdaKKKADNFFFABmjrRRQAZozRRQAdKM0UUAHWjNFFABmjpRRQAZooooAM0UUUAHSjNFFABRRRQAtJRRQAYpaSigApaSigAoxRRQAtJRRQAtJRRQAYoNFFABS0lFABRiiigANFFFAC0lFFAC4pDRRQAYpaSigApcUlFAAaMUUUALSUUUALikoooAMUvakooAKWkooAKKKKACijNFABRRmigAooozQAUUUZoAKKKKACijNFABRRmjrQAUUUZoAKKKM0AFFHWigAoozRQAUUZo60AFFGaM0AFFHSjNABRR1ozQAUUZo6UAFFGaKACijNFABRR0ozQAUUUUAFFLSUAFFFFABRRS0AJRRRQAUUUUAFFLSUAFFLW/4f8ABmt+JMyWVoVtU/1l1OfLhT6seKAOfqSGCa4kEcETyOeiopJP5V3X9neBfDH/ACEL6bxDfL1gsj5dup9DJ1b8Kgn+JmpW6GHQLCw0SDoBawgyfi55NK4FKy+HPiu+jEg0mW3iP8d0RCP/AB7FXf8AhXkdtkal4q0K1YdVFz5jD8FFcvf61qmqSF7/AFG6uWPeWVm/mao0ajO0/wCEU8Jx8S+O4M9/K0+Rx+eRSf8ACM+Du3joZ99KkH/s1cXS0WfcLnZjwboE3Fr4405z2E8DxfzzSN8NtWmUtpt9pWpD0tbxSfyOK438aVXZGBVipHcHFFn3DQ1dS8L65pGft+lXUKj+Nozt/McVk4rf03xt4j0oBbbVrgx/88pW8xPybIrXHi7QtZ+TxH4dg8xut3px8mQe5XoaLsNDiKK7aTwPaatG0/hTV4tQwMmzmxFcL+B+9+Fcjd2dzYXD293BJBMhwySKVI/A0JphYr0UUtMQlFFFABRS0lABRS0lABRRS0AJRRS0AJRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABVvTtNvNWvorKwtpLi5lOEjjUkmtLwv4U1DxVqJtrNVSGMb7i5lOI4E7sx7V02p+LNN8LWEuheCiQzDZeaww/e3B7hP7qfSgB40Xw14EUSeIXTWdbAyNMt3/cwn/pq46n/ZFc34g8baz4jxDcziCyTiKzth5cKDsAo6/U1z7u0jlmYsxOSSckmm0AFFFFABRRRQAUUUUAFFFFABRRRQBJFNJBIssUjJIpyrKcEH612Fn43i1K3TT/FlmNStgNqXS/LcQ+4b+L6GuLpaTVwudXrXgxobE6toV0uqaT1MkY/eQ+0i9R9a5PFamh6/qHh++F1YTlG6Oh5SQejDuK6i60jTPGtpLqPh6JbTVo133Ol54k9Wi/wpXa3HucHRTpEaNyjqVZTggjBBptUIKOtFFABRRRQAUUUdqADrRRRQAUUUUAGaKKKADNFFFABRmiigAozRRQAVveFPC154r1dbK2KxQoPMubl+EgjHVmNZmm6ddatqVvYWURlubhxHGg7k13Xi3VLXwpoh8E6HKGfhtXvE6zy/88wf7i8j/JoAq+LfFdnBpw8K+FQ0Giwn9/P0kvpB1dj/AHfQVwuaSigAzR1oooAKM0UUAFGaKKACnFSFBIOD0PrToYnnmSKNSzuwVQO5NeqePvBSaZ4B0m6t0BlsP3VwR3Dck/8AfX86lzSaXcajdXPJ80UUVQgzR1oooAKKKKADpVizvLmwu4rq0meGeNgyOhwQar0UAegXcFt8QNNk1GyiSHxHbJuurdBgXajq6D+96iuAIKkgggjgg1Z07UbrSb+G+s5WiuIWDIwrrvE1ha+IdHHi3SYljYkJqdqv/LKU/wAYH91qnYe5w9HSlpKoQZooooAM0UUUAHSjNFFABRRRQAtJRRQAcUUUUAFLSUUAFLSVveD9APiPxLa2DHbb7vMuH/uRLyx/KgDqND2+BfBb+I5ABrWqq0GmKesMXR5frzgV527s7s7sWZjkk9Sa6Lxv4gHiHxHLNANljbgW9nEOiRLwv59fxrm6SAWkoopgHFLSUUASw28txvESFyil2A64HU1H0rR0LUTpetWt5/CjjePVTwR+RrtvF/gUOrapoqbkYb5IF9OuV/wrKVVRmoy6lxg5RujzeloIIODwRRWpB2fwz0b+0vE6XMi5gsx5pz0Lfwj+v4V7/c6bFrXhy706cfu7hGQ+xxwfzrzz4d6V/ZXhyOR1xNdHzW9cdh+X869O0k5s/wDgRrzpVees7dDqUOWHqfJN7aS2F9PaTrtlhcxuPcHFV69J+Mugf2d4pTUolxDfpuJHaReD+Ywa82r0Iu6uczVmLVvT9Mu9UuGhtIi7Kpdz2RQMliewFaXhbwnqXizUltbGPEa8yzsPkjHv7+1eqeMtO034ffDmTTdOX/StQYQyTN9+QdWJ9scY96mU0nbqNLqeHEYNFBpKskKXik60UAFdB4Q8Q/2Bq+6dPN0+5XybyE8h4zwfxHUVz9FDVwN/xboH/CP628ETeZZTKJ7SUdHiblT/AErAru9PJ8WeAbjTW+bUtEBuLX1eA/fX8OtcLSXmNhxSUUUxBxS0lFABS0nWigAooooAKKKKACiiigAooooAO9d5pJHhz4Z6jqn3b3WpPsVue4hX/WEfXpXDRxtLKkaAl3YKAO5Ndn8R5VtL3TPD8R/daTZpGwHTzGAZz+ePypPew0cUaSiimIKKKKACg0UUAFe6+AdS/tXwtb7mzLb/ALl/wxj9MV4VXoPwo1X7Prk2nO3yXSZT/fXn+WfyrmxVPnp+hrRlyyN/xn8Pl1FZNR0mMJd9ZIRwJPcehrzbQNIk1XxDb6eyEZk/eg/wgda+k1jryDW4/wDhE/ilHdgbbW8O8+mG4b9eawoVZuDj1toaVILmTPSUURoqoMKowAOwrp9FObDP+2a5nORXSaF/x4H/AHzXHh/jOir8JgfFDQf7c8FXWxN1xaf6RFjrwDkfiM/lXhvgfwdP4x1o2qyeTbQqHnlxyFzjA9zXuvxN1r+xfA966ttmuR9njx1y3X9AayPg3og07wib+RMTX8hfJ/uLwP6n8a9OMnGDONpOR22i6JYeH9NjsdOgEUKenVj6k9zXhfxm1v8AtDxYunxvmKwj2nB43tgn9MCve9RvYtN025vZjiK3iaRj7AZr5H1K+k1LU7m9mOZJ5Gkb8Tmiiru7CbsrFSlpKK6TIKKKKACiiigDb8J602geJbK/6xK+yZezRtww/I0/xloo0LxTe2cfNuX8yA+sbcr+hrBruPFB/tjwL4d1z701uradcHv8nKZ/A0tmPocPRRRTEFHaiigAooooAKKKKACiiigAooooAKKKKAOi8DWI1DxrpULjKLOJH/3V+Y/yqh4iv21TxHqN8xz51w7D6Z4/TFb3w7xDqmqXx/5dNMnlB99uB/M1x7HJyepqV8TH0EoooqhBRRRQAUUUUAFXdKv5NL1W1vovvwSK498HpVKloauB9WWcsd3aQ3MR3RyoHU+oIzXDfF3RDd+HItTjX95ZSfMf9huD+uKu/CbV/wC0/CS2rtmaxcxEd9vVT/MfhXbalpsWqaVdWEw/d3EbRn8RXnRi6c/Q6m+aJwPhHVP7X8N2twzZlVfLk/3hx/ga9A0L/jwP++a8R+Hl1Lpet6joF1lXDEhT/fU4I/L+Ve0aXcx22lSSyMFRCzMx7ACsuTkrtIvm5qZ5b8XLyXXPFuleGbQ5KldwH99zgfkP517Hp9lFp2nW1lAMRQRrGo9gMV4v8OoX8WfEzUfEdwpMUBaRM9mPCD8Fz+Ve4EgCuupolEwjrqec/GXW/wCzvCS2Eb4lvpNhA/uDlv6D8a+ea734t65/a3jOW3Rsw2KiFcdN3Vv1OPwrg66KatEzk7sSiiirJCiiigAooooAK7jw3/xMvh14o0w4L23lX0Q9MNtc/lXEV23wyPna3qOnn7t7ps8WPfbkfypS2GjiKKXoaSmIKKKKACiiigAooooAKKWkoAKKMUtACUUUtAHXeDTs0XxVIOo00r+bAVyFdb4R50PxSo6nTs/kwrkqlbsb2QUUtJVCCilpKACijFBoAKKKWgDY8N+INX0DUVl0iVxK+A0QG4SexHevcPCXxU0nWylpqW3TtQ6bZD+7c+x7fQ18921xJa3MdxEcSRsGU+4ruY9V8N+LFEerwDTNRPAu4R8jH/a/+v8AnWNVLdo0g/M1fiTaN4Y+I1prluuIbrbKSvQkfKw/Ec/jXS+NdeXT/AM3kyDfekQxlT1DDJP5Z/OvPvE+j+JbPR4bW5mOpaVC2+3uE+fywRjGeoHt0rIutT1DxDZaVpMEMs0lqpVUQFixJ4OPYYFZumpuM77FczinE9f+HsmmeCvh9HqOrXMds96xnO77zDooA6ngZ/Guf8Q/ErXvENtef8I3aS2mm26FprxuG2/Xov0GTVSLwjb2EMerePtWICKBFZLJliAOF47ew/OsTxV8QP7V046Jo9jFp+jgj92oAZ8dM46fSrSTldakttI4iSR5ZGkkdndjlmY5JPrTaWkNbmYUUUtACUUUUAFFBooAK7L4Vtj4iaah6Osyn8Ynrjq7H4VLu+JGlHsvnMfwiek9gRyd2nl3k6f3ZGH61DU96we/uHHQysR+ZqCmAUUYpe1ACUUUtACUUUUAFFFFABRRRQAUUUUAdb4F/ey61Z97jTJgv1ABH9a5M8V0Xge6W18XWG8jZMxhbPo4K/1rH1O2ay1O6tWGGhlZD+BIqF8bRT2KlFFbWieHZ9XiluWmitbKD/W3Mxwq+w9T7VTaSuxJX2MWiusHg+2vopf7G1q3v7iJSzQeWUZgOu3PWuUKlWKkEEHBBpRkpbA01uJRWvJoTx+GYdb85Sks5hEW3kEDrmm+HtEfxBq6afHMsLMjNvYZHAzT5la4WZlUU912SMmc7SRmuo03wfBd+HotZvNat7GCWUxKJI2bkfShyS3BJs5SlrsYvA0OoRTDRtfstQuYkL/Z1VkZgPTPWuOIwxB6ihST2BqxvaB4v1Xw++23n8y3P3reX5kP4dvwrqJfiTY2Voz6DocFlfz8zTFQQp9sDn/PFcj/AMI/J/wiX9v+evl/avs3lbec4znNY6gswUAkk4GKhwhJ3K5pItX+pXmqXTXN7cyXEzdWkbP5elVa7VvAthpyxx674ltdOvXUP9m8ppGQHpuI6Vi+JPDNz4cng3zRXNrcp5lvcwnKSr7e/tVJrZE2Zh0VpaBpD69rlppccqxPcvsDsMgfhXST+CtEtrmS2m8Z2CSxuUdTA/BBwRTckgscTRW/4m8LXXhqS2aSeG6tLpN9vcwHKSDv+NYkMMlxMkMKM8sjBUVRkknoKE7iI6K7d/AdhpgSPXvE1pp966gm2WMysmf7xB4rJ8R+Ervw/HBdefDeafc58i7tzlG9j6H2oUkx2Zz1FOVdzBfU4rX8T+H5PDWrfYJJ1nbykk3quB8wzincRjV3HwrUJ4qnvT9yzsLiYn0+Qj+tcPXeeDANP8E+MNYYEH7NHZRe7SOM/oKT2BHCEksSe5pKKKYBRRRQAUUUUAFFFFAC0lFFABRRRQAUtJRQBNbTvbXMU6HDxuHU+4Oa6Lx1Ch15dQhH7jUIUuUPuR8361y9daw/tnwCjD5rnSJcH1ML/wCBFRLRplLVNHJ12GrMYfhxoccPEc00rzEd2B4z/ntXH10mi63YHSJNE1qOVrJn8yKWL78LeoHcUqiej7Di90Ylhc3dpdpNYySJcDhDH97moJWd5naUkyFiWz1z3rsbG98L+G5Tf2M9zqN8oPkCSLy0jJ4yeea5C4ne5uZZ5W3PI5dj6knJqoyu72E1Zbne2Meky/DO0XV7i4hh+3OVaBAxLY9DVzwVbeF4/EkTaZfX8t15Um1JoQq42nPINclPrFrJ4FtdIUv9qju2lb5fl2kHvTfB2r2uieIor683+SsbqdgyclSBWTg3FlqSujEn/wBfJ/vH+dei2drpl38KrBNU1FrGEXzlZFhMmTg8YFecysHldh0LEiujudcs5fAFnoyl/tcV20zfL8u0g96uabtYmLWp1emafo3g2xHimxvbjV8K0UXlxbEjcjHz85HWvMZHMkrO3ViSfxrpfB/iSHRri4tNSRptJvEMdxEBnHHDAetc9eLbpezLaSNJbhz5bMMEr2yPWnBNN3FJ3Wh1/wDzR0f9hX/2SuNhd45o3jB3qwK4Gea6H+27T/hXv9i5f7X9u8/7vy7duOvrWDZ3T2V5DdRYEkLh1z6g5pxW4M76/wBS8IeLrr7VrLXukasyqs0iJ5kTEDGcdRWR4u0S+0nTdOZNWXU9EbcLOWM/Kp/iGOxrS1C88E+KLk6ne3V7pN9Lg3EccIkRm7lfTNZfifX9NuNIsdB0SOcadZu0nm3GN8rnqcDoKmN7qw2R/Dz/AJH/AEb/AK7j+RrqJ/CPhXW/Ft3ap4rdLya5f9y1oV+YsflDE4JrivCOqW2jeK9O1G7LeRBLvfYMnGOwqrqt8txr15fWrMqyXLyxt0IyxI+hptNvQSeh0vj3U4FSw8NWlrcw2+kBkLXQxJI7ck47D0+tR/C6GGf4gaeJgCE3ugP94KSP1pPFfiLTfFGi6feSh49fhXybkhPkmUdGz6/4mua0vUrjSNTt9QtG2z27h1J6cdjTS92wX1HavPNc6zez3DM0zzuXLdc5NdjoLG6+EniSG4JMNtPDJBu/hcnnH+e9JfT+BvEty2pXN1e6PdynfcQRw+bG7dypzxn3qh4h8S6cdCi8O+HoJYdMSTzZpZ8eZcP2Jx0A9KW9kC0OTi/1yf7wrtPir/yOQ/69If8A0GuLjIWRWPYg10XjrXLPxB4h+22PmeV9njj+dcHKrg1T3F0ObrvNaH9ifCjRNNPyz6rcvfyjvsA2p+fWuU0DSJtd16x0uBSZLmVU+g7n8Bk1ufEjVodT8XTQWhH2HTkWxtgOmyPjI+pyaYjkqSiigAooooAKWkooAKKKKAFpKKKADFLSUUAFLSUUAFb3hPUotP1gRXXNldqbe4B6bW4z+B5rBpQcUpLmVhp2dy/rWmSaPqtxZS8mNvlb+8vY/iKz666cDxP4XW4XnU9LTbKO8sPZvwrksVMJNrXcclZ6BSUUVZIuKQ0UUAFLSUUAFLikooADRRRQAtJRRQAuKSiigAxS0lFABS4pKKAA0uKStjwz4fu/E+v2ul2g+eZvnc9I0HLMfYDNAHV+DUHhbwlqnjGYbbqRWsdLB6mRhh3H+6pP6158xLMWY5JOSTXYfELXrXUNRt9G0k40bR4/s1tj/loR9+Q+7EVxtAC4pKKKADFL2pKKAClpKKACiiigAoozRQAUUZooAKKKM0AFFFGaANDR9Vn0bUoryDkqcOh6Op6g/WtLxJpMEax6vpvzabd8qB1ifuhrnq2/D+tpp5ls72MzabdfLPF6ejL7iokmnzIqLvozDorZ13Qn0mVJYnE9hON1vOvRh6H3rGqoyUldCasFFGaOtMQUUUZoAKKKM0AFFHWigAoozRQAUUZo60AFFGaM0AFFHSlALEADJNADo4nlkWONS7uQqqBkknoK9K1Ep8NfCb6PEw/4SfV4gb11PNpAekeezHvSaTY23w30mPX9XjSXxFcJu02wfnyAf+Wsg9fQf5Hnd9fXOpX017eStNcTOXkkY8sx6mgCA80lGaOlABRRmigAoozRQAUUdKM0AFFFFABRS0lABRRRQAUUUtACUUUUAFKDSUUAbuia8tlE9hfxfadMmP7yI9VP95fQ0us+HjZwjULCT7XpknKTL1T/AGWHY1hVpaPrl5o0zNbsrROMSwuMpIPQis3Fp80S009JGYaK6x9I0vxGpm0WQWt6Rl7CVsBj/sN/Q1zd3Z3FjO0F1C8Mq9VcYNVGalp1E4tFeilxRVEiUUUUAFFBooAKKWkoAKKKKACilxXReH/Beqa8jXIVLTTo+Zb25OyNB9T1PsKG7AYVtbTXlzHb28TyzSMFREGSxPYCvQ7ax0z4awJfaqsV94nZd1tY53R2no8nq3oKrTeJ9H8H272XhBDPfOu2bWJ1+b3EQ/hHvXBzTSXE7zTSNJI7FmdzksT3Jpbj2LGqapeazqU2oX87T3Mzbndj/niqdFFMQUUtJQAUUUUAFFFL2oASiiigAooooAKKKKACiiigAooooAKKKKACiiigApaSigBysUYMpII5BHauitfFjywLaa1apqVqOAZOJUH+y9c3S1MoqW402tjqToGj6v8ANomqLHKf+XW9+RvoG6GsjUfD2raW3+mWMsa/3wNy/mOKzcmtXT/EusaYAtrfyiP/AJ5sdy/keKm01s7lXi9zKIIoxXUDxdbXXGqaBp9ye7xqYnP4ij7T4Luf9ZY6pZn/AKZTK4/UUc76oXKujOWorqlsfBcn/MZ1GL/ftgf5U7+y/BY5PiK7PsLM0+ddmHKcpiiurEHgWE5e81i49kjRM/nTxrfhGy/48/DUty46NeXJI/75UUc99kHL5nKRQSzuEhjeRzwFRSSa6ex+H2tTwi5vxDpdn3nvZBH+S9T+VPl+IWqxoY9Lt7HS4zx/okAVsf7xya5u91K91GYy3t3NcSH+KVyx/Wn7z8haHXC58G+GRm2hfxBqC9JJl8u2U+y9WrC17xZq/iJ1F9cnyE/1dtENkUY9lFYlFNILhRRRTEFFFFABR1oooAKKKKACiijtQAdaKKKACiiigAzRRRQAZooooAKM0UUAFGaKKACiiigAzRRRQAZo60UUAFGaKKACjNFFAB1ooooAM0UUUAGaOtFFABRRRQAdKM0UUAHWiiigAo6UUUAGaKKKADNFFFAB0ozRRQAUUUUALSUUUAFFFFABS0lFABRRRQAUUUUALSUUUAFBoooAKWkooAKKKKAA0UUUALSUUUALSUUUAFLSUUAFLSdaKACiiigBaSijrQAtJRRQAUtJRQAUtJ1ooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACg0UUAFLSUUAFFFFAAaKKKAFpKKKACiiigApaSigAooooAKKKKAFpKKKACiiigAo7UUUAFFFFABRRRQAUUUUABooooAO1FFFABQaKKACjtRRQAUUUUAFFFFAB2ooooAKKKKACjtRRQAUUUUAFFFFAB2ooooABRRRQAUdqKKACgUUUAFFFFAAaKKKAAUUUUAFFFFAH/9k=';
const HEADER_URI = `data:image/jpeg;base64,${HEADER_JPEG_B64}`;

export interface PrintContratContext {
  contrat: any;
  employe?: any;
  employeur?: any;
}

const escapeHtml = (s: any): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatDateFr = (s: string | null | undefined): string => {
  if (!s) return '—';
  const t = String(s).trim();
  if (!t || !/[\dT]/.test(t)) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) {
    // déjà format JJ/MM/AAAA ?
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t;
    return escapeHtml(t);
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatDateShort = (s: string | null | undefined): string => {
  if (!s) return '—';
  const t = String(s).trim();
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-FR');
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t;
  return escapeHtml(t);
};

const formatMoney = (n: number | null | undefined): string => {
  if (n === null || n === undefined || n === 0) return '—';
  return `${Number(n).toLocaleString('fr-FR')} FCFA`;
};

const calcAge = (dateNaissance: string | null | undefined): number | null => {
  if (!dateNaissance) return null;
  const d = new Date(String(dateNaissance));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
};

export function buildContratHtml(ctx: PrintContratContext): string {
  const c = ctx.contrat || {};
  const e = ctx.employe || {};
  const emp = ctx.employeur || {};

  // Numéro / dates - snapshot d'abord, fallback relation
  const numero = escapeHtml(c?.numero_dossier || '—');
  const dateSignature = c?.date_signature || c?.date_contrat || new Date().toISOString();
  const dateSignatureStr = formatDateShort(dateSignature);
  const dateSignatureLong = formatDateFr(dateSignature);

  // Client (employeur devient Client) - snapshot prioritaire
  const clientNom = escapeHtml(
    c?.client_nom_snapshot || c?.nom_complet || emp?.nom_complet || emp?.raison_sociale || '—',
  );
  const clientDomicile = escapeHtml(c?.client_domicile || emp?.adresse || c?.domicile_employe || '—');
  const clientPieceNum = escapeHtml(c?.client_piece_numero || (emp as any)?.piece_numero || '—');
  const clientPieceDateRaw = c?.client_piece_date || (emp as any)?.piece_date || null;
  const clientPieceDate = clientPieceDateRaw ? formatDateShort(String(clientPieceDateRaw)) : '—';

  // Employé - snapshot + fallback fiche
  const employeNomComplet = escapeHtml(
    [c?.employe_prenom, c?.employe_nom].filter(Boolean).join(' ') ||
      [e?.prenom, e?.nom].filter(Boolean).join(' ') ||
      c?.employe_nom_complet ||
      '—',
  );
  const employeAgeVal = c?.employe_age ?? calcAge(e?.date_naissance ?? c?.date_naissance);
  const employeAge = employeAgeVal !== null && employeAgeVal !== undefined ? `${employeAgeVal} ans` : '—';
  const employeSexe = escapeHtml(c?.employe_sexe || (e as any)?.sexe || '—');
  const employePoste = escapeHtml(c?.poste || (e as any)?.categorie_emploi || '—');
  const employeAdresse = escapeHtml(
    c?.employe_adresse_actuelle || e?.lieu_residence || c?.domicile_employe || '—',
  );
  const employePiece = escapeHtml(
    c?.employe_piece_reference || (e as any)?.piece_reference || '—',
  );

  // Prix - Art 3 + Art 8
  const fraisTransport = c?.frais_transport ?? c?.frais_transport_montant ?? 5000;
  const fraisTransportStr = formatMoney(fraisTransport);
  const retenue = c?.retenue_salaire_montant ?? (c?.salaire ? Math.round(Number(c.salaire) / 3) : null);
  const retenueStr = retenue !== null && retenue !== undefined ? formatMoney(retenue) : '—';

  // Pour compatibilité ancien contrat, on garde salaire si présent mais non affiché comme avant
  // (le nouveau papier n'affiche que Art3/Art8)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Contrat ${numero}</title>
<style>
  @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #111827;
    font-family: "Times New Roman", Times, Georgia, serif;
    line-height: 1.35; font-size: 10pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { width: 100%; background: #fff; }
  .header {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    border-bottom: 2px solid #0c1f3f; padding: 8px 0 6px; margin-bottom: 8px;
    text-align: center;
  }
  .header img.logo { width: 42px; height: 42px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; flex-shrink: 0; }
  .header .brand { font-family: Arial, Helvetica, sans-serif; }
  .header .kicker { font-size: 6.5pt; letter-spacing: .06em; text-transform: uppercase; color: #0c1f3f; font-weight: 700; line-height: 1.2; }
  .header .name { font-size: 15pt; font-weight: 900; color: #0c1f3f; letter-spacing: .03em; line-height: 1; margin-top: 1px; }
  h1.doc-title {
    text-align: center; font-family: Arial Black, Arial, sans-serif;
    font-size: 12pt; font-weight: 900; color: #0c1f3f;
    letter-spacing: .04em; text-transform: uppercase;
    margin: 6px 0 4px;
  }
  .ref-badge {
    text-align: center; margin-bottom: 6px;
  }
  .ref-badge span {
    display: inline-block; font-family: Arial, sans-serif; font-size: 7.5pt; font-weight: 800;
    background: #0c1f3f; color: #fff; padding: 3px 8px; border-radius: 999px;
  }
  .divider { height: 1px; background: #0c1f3f; opacity: .12; margin: 6px 0 8px; }
  h2.article {
    font-family: Arial, Helvetica, sans-serif; font-size: 9pt; font-weight: 800;
    color: #fff; background: #0c1f3f; padding: 5px 8px; border-radius: 4px;
    margin: 10px 0 6px; letter-spacing: .03em; text-transform: uppercase;
    break-after: avoid; page-break-after: avoid;
  }
  h3.sub { font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: 800; color: #0c1f3f; margin: 8px 0 3px; }
  p { margin: 0 0 6px; text-align: justify; hyphens: auto; }
  ul.dash { margin: 4px 0 6px 16px; padding: 0; }
  ul.dash li { margin-bottom: 3px; }
  .field { display: inline-block; min-width: 110px; border-bottom: 1px dotted #111827; padding: 0 3px 1px; font-weight: 700; color: #0c1f3f; }
  .field.small { min-width: 80px; }
  .field.wide { min-width: 200px; }
  .field.full { min-width: 300px; }
  .parties { border: 1px solid #c8d0dc; border-radius: 6px; padding: 8px 10px; background: #f8fafc; margin-bottom: 8px; }
  .parties p { margin-bottom: 4px; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .sig { border: 1px solid #98a2b3; border-radius: 6px; min-height: 100px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
  .sig p { margin: 0; font-family: Arial, sans-serif; font-size: 7.5pt; color: #5c6675; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; }
  .sig small { font-family: Arial, sans-serif; color: #0c1f3f; font-weight: 800; font-size: 8.5pt; }
  .sig-line { border-top: 1px solid #98a2b3; margin-top: 24px; padding-top: 4px; font-family: Arial, sans-serif; font-size: 7pt; color: #5c6675; text-align: center; }
  .footer {
    margin-top: 10px; border-top: 1px solid #e5e7eb; padding: 6px 0 0;
    font-family: Arial, sans-serif; font-size: 6.5pt; color: #5c6675; text-align: center; line-height: 1.35; background: #f8fafc;
  }
  .footer strong { color: #0c1f3f; }
  section { break-inside: avoid; page-break-inside: avoid; }
  @media print {
    body { font-size: 10pt; }
  }
</style>
</head>
<body>
<div class="sheet">

  <header class="header">
    <img class="logo" src="${HEADER_URI}" alt="Logo">
    <div class="brand">
      <div class="kicker">Placement de personnels &bull; Service de nettoyage &bull; Courtage immobilier</div>
      <div class="kicker">T&eacute;l : +225 27 22 34 22 83 / +225 05 03 97 47 75</div>
      <div class="name">CHRISROI AGENCE</div>
    </div>
    <img class="logo" src="${HEADER_URI}" alt="" style="visibility:hidden; width:42px;">
  </header>

  <h1 class="doc-title">Contrat de prestation de service de placement</h1>
  <div class="ref-badge"><span>R&eacute;f. ${numero} &mdash; Fait &agrave; Abidjan le ${dateSignatureStr}</span></div>
  <div class="divider"></div>

  <p style="font-family: Arial, sans-serif; font-size:9pt; text-align:center; font-weight:700; color:#0c1f3f; margin-bottom:6px;">Entre les soussign&eacute;s :</p>

  <div class="parties">
    <p><strong>Chrisroi Agence</strong> en abr&eacute;viation <strong>C.R.A</strong>, Entreprise individuelle au Capital de <strong>500&nbsp;000&nbsp;FCFA</strong> ; ayant son Si&egrave;ge Social &agrave; <strong>Cocody Angr&eacute;-Ch&acirc;teau, Rue&nbsp;M42</strong> ; immatricul&eacute;e au <strong>RCCM&nbsp;N&deg;&nbsp;CI-2023-0063618S</strong> ; repr&eacute;sent&eacute;e par <strong>Mme&nbsp;Yao&nbsp;Lou&nbsp;Rose</strong> en sa qualit&eacute; de g&eacute;rante ; ci-apr&egrave;s d&eacute;sign&eacute;e &laquo;&nbsp;Le prestataire&nbsp;&raquo; ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:6px 0;">D&rsquo;une part ;</p>
    <p><strong>Et</strong></p>
    <p><span class="field full">${clientNom}</span> ;</p>
    <p>Domicili&eacute;(e) &agrave; <span class="field wide">${clientDomicile}</span> ;</p>
    <p>Titulaire de la pi&egrave;ce d&rsquo;identit&eacute; num&eacute;ro <span class="field">${clientPieceNum}</span> d&eacute;livr&eacute;e le <span class="field small">${clientPieceDate}</span> ;</p>
    <p>Ci-apr&egrave;s d&eacute;sign&eacute;(e) &laquo;&nbsp;Le client&nbsp;&raquo; ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:6px 0;">D&rsquo;autre part ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:#0c1f3f;">Il a &eacute;t&eacute; convenu ce qui suit :</p>
  </div>

  <section>
    <h2 class="article">Article 1 &mdash; Objet du contrat</h2>
    <p>Le pr&eacute;sent contrat a pour objet de formaliser les conditions dans lesquelles le prestataire fournit au client une prestation de service d&rsquo;interm&eacute;diation consistant &agrave; rechercher, &eacute;valuer et pr&eacute;senter un employ&eacute; pour r&eacute;pondre aux besoins exprim&eacute;s par le client, en contrepartie d&rsquo;une r&eacute;mun&eacute;ration convenue entre les parties, dont les modalit&eacute;s et montants sont pr&eacute;cis&eacute;s &agrave; l&rsquo;article&nbsp;3 du pr&eacute;sent contrat.</p>
    <p>En ex&eacute;cution de cette mission, le prestataire a mis en relation le client avec :</p>
    <div class="parties" style="background:#fff;">
      <p>Nom et pr&eacute;nom de l&rsquo;employ&eacute; : <span class="field wide">${employeNomComplet}</span></p>
      <p>&Acirc;ge : <span class="field small">${employeAge}</span> ; Sexe : <span class="field small">${employeSexe}</span> ;</p>
      <p>Poste attribu&eacute; : <span class="field wide">${employePoste}</span> ;</p>
      <p>Adresse actuelle de r&eacute;sidence : <span class="field wide">${employeAdresse}</span> ;</p>
      <p>Num&eacute;ro de pi&egrave;ce d&rsquo;identit&eacute; / R&eacute;f&eacute;rence d&rsquo;identification : <span class="field">${employePiece}</span>.</p>
    </div>
  </section>

  <section>
    <h2 class="article">Article 2 &mdash; Dur&eacute;e du contrat</h2>
    <p>Le pr&eacute;sent contrat est conclu pour une dur&eacute;e initiale de <strong>trois (03) mois</strong> &agrave; compter de sa date de signature. Cette dur&eacute;e correspond au d&eacute;but et &agrave; la fin de la p&eacute;riode de suivi de l&rsquo;int&eacute;gration de l&rsquo;employ&eacute; propos&eacute; et embauch&eacute;.</p>
    <p>Toute prestation de remplacement pr&eacute;vue dans cette p&eacute;riode est couverte par les conditions d&eacute;finies &agrave; l&rsquo;article&nbsp;7.</p>
  </section>

  <section>
    <h2 class="article">Article 3 &mdash; Prix de la prestation</h2>
    <p>Le prix de la prestation est fix&eacute; &agrave; <strong>15&nbsp;000&nbsp;FCFA</strong> payable en esp&egrave;ces ou par d&eacute;p&ocirc;t mobile money d&egrave;s la signature du pr&eacute;sent contrat.</p>
    <p>Celui-ci est <strong>non remboursable</strong>.</p>
    <p>Le d&eacute;placement d&rsquo;un agent de Chrisroi Agence pour le placement ou le retrait d&rsquo;employ&eacute; entra&icirc;ne des frais de transport qui s&rsquo;&eacute;l&egrave;vent &agrave; <span class="field small">${fraisTransportStr}</span>.</p>
  </section>

  <section>
    <h2 class="article">Article 4 &mdash; Engagements du prestataire</h2>
    <p>Le prestataire s&rsquo;engage &agrave; fournir au client une prestation de mise en relation en vue du recrutement d&rsquo;un employ&eacute;, dans les conditions suivantes :</p>
    <h3 class="sub">Obligation de moyens :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; mettre en &oelig;uvre les moyens n&eacute;cessaires &agrave; l&rsquo;identification, l&rsquo;&eacute;valuation et la pr&eacute;sentation de candidats r&eacute;pondant aux crit&egrave;res exprim&eacute;s par le client. Il est donc tenu d&rsquo;une obligation de moyens et non de r&eacute;sultat quant &agrave; la r&eacute;ussite de l&rsquo;int&eacute;gration du candidat.</p>
    <h3 class="sub">Processus de s&eacute;lection :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; proc&eacute;der &agrave; un entretien avec chaque candidat propos&eacute;, v&eacute;rifier dans la mesure du possible l&rsquo;exactitude des informations transmises (identit&eacute;, r&eacute;f&eacute;rences, exp&eacute;riences) et appr&eacute;cier l&rsquo;aptitude g&eacute;n&eacute;rale du candidat &agrave; exercer les fonctions envisag&eacute;es.</p>
    <h3 class="sub">Ind&eacute;pendance juridique :</h3>
    <p>Le prestataire n&rsquo;est en aucun cas employeur des candidats retenus. Elle n&rsquo;assume aucun lien de subordination &agrave; leur &eacute;gard, ni aucune responsabilit&eacute; dans l&rsquo;ex&eacute;cution de la relation de travail entre le client et le salari&eacute; recrut&eacute;.</p>
    <h3 class="sub">Limitation de responsabilit&eacute; :</h3>
    <p>Lorsque le prestataire a objectivement fait preuve de diligence, de rigueur et de bonne foi, il ne saurait &ecirc;tre tenue responsable des fautes ou pr&eacute;judices caus&eacute;s par l&rsquo;employ&eacute; apr&egrave;s sa prise de fonction, de la rupture de contrat entre le client et l&rsquo;employ&eacute;, des informations inexactes fournies par le candidat sans que leur fausset&eacute; puisse &ecirc;tre raisonnablement d&eacute;tect&eacute;e.</p>
    <h3 class="sub">Confidentialit&eacute; :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; garder confidentielles toutes les informations personnelles, professionnelles ou strat&eacute;giques obtenues dans le cadre du pr&eacute;sent contrat, sauf accord expr&egrave;s du client ou obligation l&eacute;gale contraire.</p>
  </section>

  <section>
    <h2 class="article">Article 5 &mdash; Engagements du client</h2>
    <p>Le client s&rsquo;engage &agrave; :</p>
    <ul class="dash">
      <li>Fournir au prestataire des informations exactes sur le poste &agrave; pourvoir, les t&acirc;ches, les horaires et le lieu de travail.</li>
      <li>Traiter le personnel mis &agrave; disposition avec respect et dignit&eacute;, dans des conditions conformes aux dispositions l&eacute;gales et r&eacute;glementaires en vigueur.</li>
      <li>Signer un contrat de travail direct avec l&rsquo;employ&eacute; s&eacute;lectionn&eacute;.</li>
      <li>Informer le prestataire de toute difficult&eacute; s&eacute;rieuse survenue dans la relation de travail.</li>
    </ul>
    <p>Le prestataire ne saurait &ecirc;tre tenu de r&eacute;parer les dommages qui d&eacute;coulent du non-respect des dispositions du pr&eacute;sent article.</p>
  </section>

  <section>
    <h2 class="article">Article 6 &mdash; Conditions de r&eacute;siliation du contrat</h2>
    <p>La r&eacute;siliation du contrat suppose l&rsquo;extinction de l&rsquo;obligation de remplacement.</p>
    <p>Le prestataire se r&eacute;serve le droit de mettre fin au contrat avant l&rsquo;arriv&eacute;e de son terme dans les cas suivants :</p>
    <ul class="dash">
      <li>Refus injustifi&eacute; du client de formaliser un contrat de travail avec l&rsquo;employ&eacute; retenu.</li>
      <li>Traitement abusif, irrespectueux, d&eacute;gradant ou ill&eacute;gal inflig&eacute; &agrave; l&rsquo;employ&eacute;.</li>
      <li>Non-paiement des frais convenus dans le d&eacute;lai imparti.</li>
      <li>Recrutement direct d&rsquo;un candidat propos&eacute; sans paiement de la r&eacute;mun&eacute;ration due au prestataire.</li>
      <li>Non-respect des obligations contractuelles ou de bonne foi.</li>
    </ul>
  </section>

  <section>
    <h2 class="article">Article 7 &mdash; Remplacement de l&rsquo;employ&eacute;</h2>
    <p>Le remplacement sans frais en cas de rupture de contrat et d&rsquo;abandon de poste n&rsquo;est possible que dans la p&eacute;riode de suivi de <strong>trois (03) mois</strong>. Au-del&agrave;, il y a signature d&rsquo;un nouveau contrat.</p>
    <p>Dans les cas o&ugrave; le contrat de travail liant l&rsquo;employ&eacute; au client est rompu, le prestataire a l&rsquo;obligation de proc&eacute;der, dans un d&eacute;lai de <strong>sept (07) jours</strong>, au remplacement sans frais de cet employ&eacute; dans les conditions suivantes :</p>
    <ul class="dash">
      <li>L&rsquo;employ&eacute; d&eacute;missionne sans respecter le d&eacute;lai l&eacute;gal de pr&eacute;avis (01&nbsp;mois) ;</li>
      <li>Ou le client licencie son employ&eacute; pour un motif l&eacute;gitime sans respecter le d&eacute;lai l&eacute;gal de pr&eacute;avis (01&nbsp;mois).</li>
    </ul>
    <p>Dans les cas o&ugrave; le d&eacute;lai l&eacute;gal de pr&eacute;avis est respect&eacute;, le prestataire effectuera un remplacement d&egrave;s la fin dudit d&eacute;lai.</p>
    <p>Dans les cas o&ugrave; le contrat de travail liant l&rsquo;employ&eacute; au client est suspendu pour cause de maladie d&ucirc;ment constat&eacute;e par certificat m&eacute;dical, le prestataire a l&rsquo;obligation de proc&eacute;der, dans un d&eacute;lai de <strong>cinq (05) jours</strong>, au remplacement temporaire sans frais de cet employ&eacute; par un autre embauch&eacute; &agrave; cet effet. Le contrat de travail de ce dernier sera conclu pour la dur&eacute;e de l&rsquo;arr&ecirc;t maladie de l&rsquo;employ&eacute; malade. Le client aura pour obligation de reprendre ce dernier lorsqu&rsquo;il sera r&eacute;tabli.</p>
    <p>En cas d&rsquo;abandon de poste intervenu moins d&rsquo;une (01) semaine apr&egrave;s l&rsquo;embauche de l&rsquo;employ&eacute;, le prestataire disposera de <strong>trois (03) jours</strong> pour effectuer un remplacement de l&rsquo;employ&eacute;.</p>
    <p><em>Le prestataire n&rsquo;effectuera aucun remplacement lorsque la rupture du contrat de travail liant le client &agrave; l&rsquo;employ&eacute;, ou l&rsquo;abandon de poste a &eacute;t&eacute; motiv&eacute;e par des actes du client condamn&eacute;s par l&rsquo;employ&eacute;. &Agrave; savoir : un mauvais traitement de l&rsquo;employ&eacute;, un ou des impay&eacute;s de salaire, des attouchements ind&eacute;cents, de l&rsquo;harc&egrave;lement sexuel, de la violence physique et morale et autres actes d&eacute;gradants.</em></p>
  </section>

  <section>
    <h2 class="article">Article 8 &mdash; Retenue sur salaire &agrave; destination de l&rsquo;agence</h2>
    <p>Le client s&rsquo;engage &agrave; effectuer, le premier mois de travail de l&rsquo;employ&eacute;, une retenue sur le salaire net de celui-ci correspondant &agrave; <span class="field">${retenueStr}</span> &agrave; reverser directement au prestataire en esp&egrave;ce ou par d&eacute;p&ocirc;t mobile money.</p>
    <p>Le non-respect de cette clause est une cause de r&eacute;siliation du pr&eacute;sent contrat.</p>
  </section>

  <section>
    <h2 class="article">Article 9 &mdash; Conditions de d&eacute;part de l&rsquo;employ&eacute;</h2>
    <p>Lorsque l&rsquo;employ&eacute; r&eacute;side au domicile de son employeur, le client, celui-ci s&rsquo;engage &agrave; ne pas forcer l&rsquo;employ&eacute; &agrave; quitter son domicile nuitamment et/ou dans des conditions pr&eacute;caires.</p>
    <p>Toutefois, la possibilit&eacute; est reconnue au client de faire fi de la disposition ci-dessus lorsque la pr&eacute;sence de l&rsquo;employ&eacute; menace ses biens, sa vie ou celle des autres r&eacute;sidents du domicile, et en l&rsquo;absence d&rsquo;alternative raisonnable.</p>
    <p>Le non-respect de cette clause engage la responsabilit&eacute; du client pour les pr&eacute;judices que pourrait rencontrer l&rsquo;employ&eacute; en cours de route si un rapport de causalit&eacute; est &eacute;tabli.</p>
  </section>

  <section>
    <h2 class="article">Article 10 &mdash; R&egrave;glement des litiges</h2>
    <p>Tout diff&eacute;rend relatif au pr&eacute;sent contrat fera l&rsquo;objet d&rsquo;un r&egrave;glement amiable.</p>
    <p>&Agrave; d&eacute;faut d&rsquo;accord, les parties s&rsquo;engagent &agrave; recourir &agrave; une m&eacute;diation avant toute action en justice.</p>
    <p>En cas d&rsquo;&eacute;chec, l&rsquo;affaire sera port&eacute;e devant les juridictions comp&eacute;tentes.</p>
  </section>

  <div style="margin-top:10px; border:1px solid #0c1f3f; border-radius:6px; padding:8px 10px; background:#f8fafc; text-align:center;">
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:0;">Fait &agrave; Abidjan le <span class="field small">${dateSignatureStr}</span></p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-size:7.5pt; color:#5c6675; margin:3px 0 0;">En deux exemplaires originaux, un pour chaque partie.</p>
  </div>

  <div class="sign-grid">
    <div class="sig">
      <div>
        <p>Le client</p>
        <small>${clientNom}</small>
        <div style="font-family: Arial, sans-serif; font-size:7pt; color:#5c6675; margin-top:3px;">Lu et approuv&eacute; + signature</div>
      </div>
      <div class="sig-line">Signature pr&eacute;c&eacute;d&eacute;e de &laquo;&nbsp;Lu et approuv&eacute;&nbsp;&raquo;</div>
    </div>
    <div class="sig">
      <div>
        <p>Le prestataire &mdash; ChrisRoi Agence</p>
        <small>Mme Yao Lou Rose, G&eacute;rante</small>
        <div style="font-family: Arial, sans-serif; font-size:7pt; color:#5c6675; margin-top:3px;">Cachet + signature</div>
      </div>
      <div class="sig-line">Pour ChrisRoi Agence</div>
    </div>
  </div>

  <footer class="footer">
    <strong>CHRISROI AGENCE</strong> &mdash; EI au Capital de 500&nbsp;000&nbsp;FCFA &mdash; Si&egrave;ge Social : Cocody Angr&eacute;-Ch&acirc;teau, Rue&nbsp;M42 &mdash; T&eacute;l : +225&nbsp;27&nbsp;22&nbsp;34&nbsp;22&nbsp;83 / +225&nbsp;05&nbsp;03&nbsp;97&nbsp;47&nbsp;75 &mdash; RCCM&nbsp;N&deg;&nbsp;CI-2023-0063618S &mdash; CC&nbsp;N&deg;&nbsp;2304937&nbsp;D &mdash; Email : chrisroiagence@gmail.com &mdash; Site : Chrisroiagence.com
  </footer>

</div>
</body>
</html>`;
}
