import { Separator } from "@/components/ui/separator";
import { Heart, Beer } from "lucide-react";
import { Link } from "next-view-transitions";

const Footer = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  return (
    <footer className="mx-2">
      <Separator className="my-4" decorative />

      <div className="flex flex-col items-center text-center text-sm">
        <div className="mb-2 flex items-center gap-1 text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span>Made with</span>
            <Heart size={16} aria-hidden />
            <span>by</span>
          </span>
          <Link
            href="https://github.com/ignaguri"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            @ignaguri
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {isLoggedIn && (
            <>
              <Link
                href="https://www.paypal.me/ignacioguri"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buy me a beer (opens PayPal)"
                className="inline-flex items-center gap-1 text-sm underline text-gray-500"
              >
                <span>Buy me a</span>
                <Beer size={16} aria-hidden />
              </Link>
              <span className="text-gray-400" aria-hidden>
                ·
              </span>
            </>
          )}

          <div className="flex items-center gap-2 text-gray-500 flex-wrap">
            <Link
              href="https://prostcounter.canny.io/bugs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Report a bug (opens Canny)"
              className="underline"
            >
              Report a bug
            </Link>

            <span className="text-gray-400" aria-hidden>
              ·
            </span>

            <Link
              href="https://prostcounter.canny.io/feature-requests"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Request a feature (opens Canny)"
              className="underline"
            >
              Request a feature
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
